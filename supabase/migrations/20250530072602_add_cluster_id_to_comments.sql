-- Add cluster_id column to comments table
ALTER TABLE comments ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES question_clusters(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_comments_cluster_id ON comments(cluster_id); 