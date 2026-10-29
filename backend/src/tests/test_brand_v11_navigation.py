"""TicketTreat v1.1 brand integration smoke test (no network, no credentials)."""
from pathlib import Path
import ast
import unittest

ROOT=Path(__file__).resolve().parents[3]
FRONTEND=ROOT/"frontend"
BOT=ROOT/"bot"/"src"/"main.py"

class NightPosterBrandTests(unittest.TestCase):
    def test_night_poster_tokens_and_high_contrast_logo(self):
        css=(FRONTEND/"app"/"tickettreat-tokens.css").read_text(encoding="utf-8")
        night=(FRONTEND/"app"/"brand-v11.css").read_text(encoding="utf-8")
        for rule in ("--ink:#15141F","--paper:#F0EBE1","--tom:#FF5533",
                     "--blu:#3B4CF0","--yel:#F4B400","--tt-font-display:var(--d)"):
            self.assertIn(rule,css)
        for rule in (".tt-night-hero",".tt-night-poster",".tt-night-home .event-card",
                     "prefers-reduced-motion",".topbar .wordmark{background:var(--paper)",
                     ".tt-support-footer.tt-legal-footer"):
            self.assertIn(rule,night)
        layout=(FRONTEND/"app"/"layout.tsx").read_text(encoding="utf-8")
        self.assertIn('import "./brand-v11.css"',layout)

    def test_event_cta_still_uses_existing_routes(self):
        home=(FRONTEND/"components"/"HomeClient.tsx").read_text(encoding="utf-8")
        events=(FRONTEND/"components"/"EventCard.tsx").read_text(encoding="utf-8")
        self.assertIn('id="events"',home)
        self.assertIn('href="/tickets"',home)
        discovery=(FRONTEND/"components"/"EventDiscovery.tsx").read_text(encoding="utf-8")
        self.assertIn('<EventDiscovery events={events} language={language}/>',home)
        self.assertIn('<EventCard key={event.id} event={event}/>',discovery)
        self.assertIn('mode==="map"',discovery)
        self.assertIn('mode==="list"',discovery)
        self.assertIn('href={`/events/${event.id}?lang=${language}`}',events)
        self.assertIn("getEvents(controller.signal)",home)

    def test_primary_bot_menu_labels_are_emoji_free_after_localization(self):
        tree=ast.parse(BOT.read_text(encoding="utf-8"))
        catalog=next(node for node in tree.body if isinstance(node,ast.Assign)
                     and any(isinstance(t,ast.Name) and t.id=="UI_TRANSLATIONS" for t in node.targets))
        data=catalog.value
        labels={"🏠 Start","📅 Events","🎟 My tickets","🏅 Passport",
                "👤 My profile","📝 Registration","🆘 Client service","⚙️ Admin"}
        seen=set()
        for key,value in zip(data.keys,data.values):
            if not isinstance(key,ast.Constant) or key.value not in labels:continue
            seen.add(key.value)
            self.assertIsInstance(value,ast.Call)
            for arg in value.args:
                self.assertIsInstance(arg,ast.Constant)
                self.assertTrue(arg.value[0].isalnum(),(key.value,arg.value))
        self.assertEqual(seen,labels)
        # Legacy emoji commands remain accepted so existing clients keep working.
        bot=BOT.read_text(encoding="utf-8")
        self.assertIn('ui_text_matches(message.text, "📅 Events")',bot)

if __name__=="__main__":
    unittest.main()
