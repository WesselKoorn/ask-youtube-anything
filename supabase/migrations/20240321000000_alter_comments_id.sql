-- Alter comments table to change id column from UUID to TEXT
ALTER TABLE comments 
    ALTER COLUMN id TYPE TEXT USING id::TEXT,
    ALTER COLUMN id DROP DEFAULT; 