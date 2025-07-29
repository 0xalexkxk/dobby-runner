CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    nickname TEXT NOT NULL,
    score INTEGER NOT NULL,
    xp INTEGER NOT NULL,
    level INTEGER NOT NULL,
    game_time INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp BIGINT NOT NULL,
    is_valid BOOLEAN DEFAULT true,
    validation_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_valid_scores ON scores(is_valid, score DESC);
CREATE INDEX IF NOT EXISTS idx_nickname ON scores(nickname);
CREATE INDEX IF NOT EXISTS idx_timestamp ON scores(timestamp);

INSERT INTO scores (nickname, score, xp, level, game_time, timestamp, is_valid) VALUES
('TestPlayer1', 150, 50, 2, 9000, 1640995200000, true),
('TestPlayer2', 85, 30, 1, 5100, 1640995260000, true),
('TestPlayer3', 245, 80, 3, 14700, 1640995320000, true);