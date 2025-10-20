CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,        -- store the hashed password here
  created_at TIMESTAMPTZ DEFAULT now()
);