CREATE TABLE IF NOT EXISTS organizer_loyalty_thresholds (
    owner_account_id INTEGER PRIMARY KEY REFERENCES demo_web_accounts(id),
    regular INTEGER NOT NULL DEFAULT 3,
    insider INTEGER NOT NULL DEFAULT 6,
    vip INTEGER NOT NULL DEFAULT 12,
    CONSTRAINT ck_loyalty_threshold_order CHECK (regular > 0 AND insider > regular AND vip > insider AND vip <= 10000)
);
