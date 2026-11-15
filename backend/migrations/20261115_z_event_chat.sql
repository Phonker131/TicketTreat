-- Isolated participant/organizer conversations. No auth, support, payments or tickets modified.
-- Uniqueness on (event_id,guest_id) prevents parallel website/Mini App duplicates.
CREATE TABLE IF NOT EXISTS tt_event_chat_threads (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  guest_id INTEGER NOT NULL REFERENCES demo_guests(id),
  status VARCHAR(8) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_participant_message_id INTEGER,
  last_organizer_message_id INTEGER,
  guest_read_message_id INTEGER,
  organizer_read_message_id INTEGER,
  closed_at TIMESTAMPTZ,
  closed_by INTEGER REFERENCES demo_web_accounts(id),
  CONSTRAINT uq_tt_event_chat_guest UNIQUE (event_id,guest_id),
  CONSTRAINT ck_tt_chat_status CHECK (status IN ('open','closed')),
  CONSTRAINT ck_tt_chat_closed CHECK (
    (status='open' AND closed_at IS NULL AND closed_by IS NULL) OR
    (status='closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS ix_tt_event_chat_threads_event_id ON tt_event_chat_threads(event_id);
CREATE INDEX IF NOT EXISTS ix_tt_event_chat_threads_guest_id ON tt_event_chat_threads(guest_id);
CREATE INDEX IF NOT EXISTS ix_tt_event_chat_threads_updated_at ON tt_event_chat_threads(updated_at DESC);

CREATE TABLE IF NOT EXISTS tt_event_chat_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES tt_event_chat_threads(id) ON DELETE CASCADE,
  sender_kind VARCHAR(12) NOT NULL,
  sender_account_id INTEGER REFERENCES demo_web_accounts(id),
  body TEXT NOT NULL,
  client_nonce VARCHAR(36) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tt_event_chat_send UNIQUE (thread_id,sender_kind,client_nonce),
  CONSTRAINT ck_tt_chat_sender CHECK (sender_kind IN ('participant','organizer')),
  CONSTRAINT ck_tt_chat_body CHECK (length(btrim(body)) BETWEEN 2 AND 2000),
  CONSTRAINT ck_tt_chat_author CHECK (
    (sender_kind='participant' AND sender_account_id IS NULL) OR
    (sender_kind='organizer' AND sender_account_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS ix_tt_event_chat_messages_thread_id ON tt_event_chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS ix_tt_event_chat_messages_created_at ON tt_event_chat_messages(thread_id,id DESC);
CREATE INDEX IF NOT EXISTS ix_tt_event_chat_messages_sender_account ON tt_event_chat_messages(sender_account_id);
