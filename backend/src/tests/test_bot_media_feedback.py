"""Media guidance without contacting Telegram or production services."""
import ast
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

SOURCE = Path(__file__).resolve().parents[3] / 'bot/src/main.py'

class MediaFeedbackTests(TestCase):
    def setUp(self):
        nodes = [n for n in ast.parse(SOURCE.read_text()).body
                 if isinstance(n, ast.FunctionDef) and n.name in
                 {'explain_media_upload', 'handle_media_document', 'handle_photo'}]
        for node in nodes:
            node.decorator_list = []
        self.send = Mock()
        self.scope = {'copy_send': self.send,
            'remember_telegram_language': lambda user: user.language_code,
            'admin_event_state': {}, 'admin_edit_state': {}, 'broadcast_state': {},
            'admin_edit_temp': {}, 'require_admin_message': lambda message: True,
            'backend_request': Mock(), 'bot': SimpleNamespace(send_message=Mock()),
            'get_main_menu': lambda user: None}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SOURCE), 'exec'), self.scope)
        self.message = SimpleNamespace(chat=SimpleNamespace(id=1,type='private'),
            from_user=SimpleNamespace(id=1,language_code='en'),
            photo=[SimpleNamespace(file_id='test-photo')])

    def test_photo_outside_upload_flow_explains_that_nothing_was_saved(self):
        self.scope['handle_photo'](self.message)
        self.assertIn('has not been saved', self.send.call_args.args[1])
        self.assertIn(('Support desk', '/support'), self.send.call_args.args[2])
        self.scope['backend_request'].assert_not_called()

    def test_document_uses_czech_guidance(self):
        self.message.from_user.language_code = 'cs'
        self.scope['handle_media_document'](self.message)
        self.assertIn('nebyl uložen', self.send.call_args.args[1])

    def test_group_upload_does_not_generate_unsolicited_reply(self):
        self.message.chat.type = 'group'
        self.scope['handle_media_document'](self.message)
        self.send.assert_not_called()

    def test_active_photo_edit_is_handled_without_fallback(self):
        self.scope['admin_edit_state'][1] = 'WAIT_EDIT_PHOTO'
        self.scope['admin_edit_temp'][1] = {'event_id': 19}
        self.scope['handle_photo'](self.message)
        self.scope['backend_request'].assert_called_once()
        self.send.assert_not_called()
        self.assertNotIn(1, self.scope['admin_edit_state'])
