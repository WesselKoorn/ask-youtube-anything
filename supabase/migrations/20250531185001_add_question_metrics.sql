-- Add unique constraint to question_metrics
ALTER TABLE question_metrics
ADD CONSTRAINT question_metrics_question_video_unique UNIQUE (question_id, video_id); 