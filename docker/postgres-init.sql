-- Soundwave: PostgreSQL schema for Users (RDB)
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    plan        VARCHAR(20)  NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed data
INSERT INTO users (name, email, password, plan) VALUES
    ('Alice Souza',   'alice@example.com', '$2b$10$examplehashedpassword1', 'premium'),
    ('Bruno Lima',    'bruno@example.com', '$2b$10$examplehashedpassword2', 'free'),
    ('Carla Mendes',  'carla@example.com', '$2b$10$examplehashedpassword3', 'premium');
