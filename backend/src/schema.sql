CREATE TABLE IF NOT EXISTS targets (
    id                    SERIAL PRIMARY KEY,
    name                  TEXT NOT NULL,
    url                   TEXT NOT NULL,
    interval_seconds      INTEGER NOT NULL DEFAULT 60,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    last_status           TEXT,
    last_response_time_ms INTEGER,
    last_checked_at       TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checks (
    id               BIGSERIAL PRIMARY KEY,
    target_id        INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
    status           TEXT NOT NULL CHECK (status IN ('up', 'down')),
    http_code        INTEGER,
    response_time_ms INTEGER,
    error_message    TEXT,
    checked_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checks_target_checked ON checks (target_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks (checked_at DESC);
