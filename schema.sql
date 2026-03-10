-- CarQuest Database Schema
-- Run this in your Neon SQL editor to create all tables

-- ============================================================
-- USERS TABLE: stores registered users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,        -- bcrypt hash
    xp          INTEGER DEFAULT 0,
    nivel       INTEGER DEFAULT 1,
    rang        VARCHAR(50) DEFAULT 'Conductor Novato',
    racha       INTEGER DEFAULT 0,
    ultima_activitat DATE DEFAULT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PROGRESS TABLE: tracks completed lessons/tests per user
-- ============================================================
CREATE TABLE IF NOT EXISTS progres (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tipus       VARCHAR(20) NOT NULL,   -- 'test', 'joc', 'teoria'
    nom         VARCHAR(100) NOT NULL,  -- name of lesson/test/game
    puntuacio   INTEGER DEFAULT 0,
    completat   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- HELPER: function to update rank based on XP
-- ============================================================
CREATE OR REPLACE FUNCTION update_rang(xp_val INTEGER)
RETURNS VARCHAR AS $$
BEGIN
    IF xp_val >= 10000 THEN RETURN 'Piloto Maestro';
    ELSIF xp_val >= 5000  THEN RETURN 'Piloto Experto';
    ELSIF xp_val >= 2000  THEN RETURN 'Piloto Seguro';
    ELSIF xp_val >= 500   THEN RETURN 'Conductor Intermedio';
    ELSE RETURN 'Conductor Novato';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MIGRATION: add racha columns if they don't exist yet
-- Run this if the DB was created before this update
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS racha INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ultima_activitat DATE DEFAULT NULL;

-- ============================================================
-- MIGRATION: update rank names from Catalan to Spanish
-- Run this to update existing data
-- ============================================================
UPDATE users SET rang = 'Conductor Novato' WHERE rang = 'Conductor Novell';
UPDATE users SET rang = 'Conductor Intermedio' WHERE rang = 'Conductor Intermedi';
UPDATE users SET rang = 'Piloto Seguro' WHERE rang = 'Pilot Segur';
UPDATE users SET rang = 'Piloto Experto' WHERE rang = 'Pilot Expert';
UPDATE users SET rang = 'Piloto Maestro' WHERE rang = 'Pilot Mestre';

-- ============================================================
-- Sample data to test the ranking (optional, delete if needed)
-- ============================================================
INSERT INTO users (nombre, email, password, xp, nivel, rang)
VALUES
    ('Marc P.',  'marc@example.com',  '$2b$10$placeholder', 8500, 9, 'Piloto Experto'),
    ('Laura M.', 'laura@example.com', '$2b$10$placeholder', 7200, 8, 'Piloto Seguro'),
    ('Joan S.',  'joan@example.com',  '$2b$10$placeholder', 6800, 7, 'Piloto Seguro')
ON CONFLICT (email) DO NOTHING;
