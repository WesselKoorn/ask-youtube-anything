-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id text PRIMARY KEY,  -- YouTube video ID
  title text,
  description text,
  published_at timestamp,
  channel_id text,
  thumbnail_url text,
  created_at timestamp DEFAULT now()
);