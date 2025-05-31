-- Add channel_id to question_clusters
ALTER TABLE question_clusters ADD COLUMN channel_id TEXT;
UPDATE question_clusters qc
SET channel_id = (
    SELECT DISTINCT c.channel_id 
    FROM comments c 
    JOIN questions q ON q.cluster_id = qc.id 
    WHERE c.cluster_id = q.cluster_id 
    LIMIT 1
);
ALTER TABLE question_clusters ALTER COLUMN channel_id SET NOT NULL;
CREATE INDEX idx_question_clusters_channel_id ON question_clusters(channel_id);

-- Add channel_id to questions
ALTER TABLE questions ADD COLUMN channel_id TEXT;
UPDATE questions q
SET channel_id = qc.channel_id
FROM question_clusters qc
WHERE q.cluster_id = qc.id;
ALTER TABLE questions ALTER COLUMN channel_id SET NOT NULL;
CREATE INDEX idx_questions_channel_id ON questions(channel_id);

-- Add channel_id to question_metrics
ALTER TABLE question_metrics ADD COLUMN channel_id TEXT;
UPDATE question_metrics qm
SET channel_id = q.channel_id
FROM questions q
WHERE qm.question_id = q.id;
ALTER TABLE question_metrics ALTER COLUMN channel_id SET NOT NULL;
CREATE INDEX idx_question_metrics_channel_id ON question_metrics(channel_id); 