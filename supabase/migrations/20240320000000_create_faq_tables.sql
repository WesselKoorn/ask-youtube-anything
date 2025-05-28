-- Create FAQ-related tables

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id TEXT NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_question BOOLEAN DEFAULT FALSE,
    question_confidence FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Question clusters table
CREATE TABLE IF NOT EXISTS question_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_question TEXT NOT NULL,
    pinecone_id TEXT NOT NULL,
    cluster_id UUID REFERENCES question_clusters(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Question metrics table
CREATE TABLE IF NOT EXISTS question_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    video_id TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_is_question ON comments(is_question);
CREATE INDEX IF NOT EXISTS idx_questions_cluster_id ON questions(cluster_id);
CREATE INDEX IF NOT EXISTS idx_question_metrics_question_id ON question_metrics(question_id);
CREATE INDEX IF NOT EXISTS idx_question_metrics_video_id ON question_metrics(video_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to read comments"
    ON comments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read question clusters"
    ON question_clusters FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read questions"
    ON questions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to read question metrics"
    ON question_metrics FOR SELECT
    TO authenticated
    USING (true); 