ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read videos"
    ON videos FOR SELECT
    TO authenticated
    USING (true);