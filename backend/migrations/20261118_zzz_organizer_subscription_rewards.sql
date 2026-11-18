-- Preview-only organizer subscription discounts. No payment data is touched.
-- Requires owner review and migration rehearsal before production rollout.
CREATE TABLE IF NOT EXISTS organizer_subscription_reward_levels (
    tier VARCHAR(16) PRIMARY KEY CHECK (tier IN ('starter','bronze','silver','gold','platinum')),
    min_events INTEGER NOT NULL CHECK (min_events BETWEEN 0 AND 10000),
    discount_pct INTEGER NOT NULL CHECK (discount_pct BETWEEN 0 AND 80)
);
