-- Add channel_id column to comments table
ALTER TABLE comments ADD COLUMN channel_id TEXT;

-- Populate channel_id from videos table
UPDATE comments 
SET channel_id = videos.channel_id 
FROM videos 
WHERE comments.video_id = videos.id;

-- Delete any comments that don't have a valid channel_id
DELETE FROM comments 
WHERE channel_id IS NULL;

-- Now we can safely make channel_id required
ALTER TABLE comments ALTER COLUMN channel_id SET NOT NULL;

-- Add index for faster channel-specific queries
CREATE INDEX idx_comments_channel_id ON comments(channel_id); 