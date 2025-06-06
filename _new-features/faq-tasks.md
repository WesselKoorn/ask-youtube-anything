I've shared with you a faq-tasks.md file. This file is a description of all the work that needs to be done to integrate a new feature along side the existing functionality that fetches comments of a YouTube channel and turns them into easy to read FAQ sections. I think all the details are inside of that integration file. What's most important is the PLAN section at the bottom of the file. There's a plan of zero to 8 steps, and I need you to figure out what step you're supposed to take next in that plan. The checkmarks will describe wether you completed that step or not. Once you determined what step to tackly next, work on it until it's completed, mark it as completed in the faq-tasks.md file and stop. I like to review each step before you go to the next one.

# Comments FAQs

### 1. Data Collection & Processing
1. **YouTube Comments API Integration**
   - Create a Next.js server function to fetch comments
   - Store comments in Supabase with metadata
   - Implement pagination and rate limiting
   - Use Supabase Edge Functions for background processing

2. **Question Detection System**
   - Create a server function for question detection
   - Use OpenAI's API for classification
   - Store results in Supabase with confidence scores
   - Implement batch processing for efficiency

3. **Question Clustering**
   - Use Pinecone for storing and querying embeddings
   - Implement clustering using OpenAI embeddings
   - Store canonical questions in Supabase
   - Create materialized views for frequent queries

### 2. Database Structure

#### Supabase Tables
```sql
-- Videos table
videos (
  id text primary key,  -- YouTube video ID
  title text,
  description text,
  published_at timestamp,
  channel_id text,
  thumbnail_url text,
  created_at timestamp default now()
)

-- Comments table
comments (
  id uuid primary key,
  video_id text references videos(id),
  author text,
  content text,
  published_at timestamp,
  is_question boolean default false,
  question_confidence float,
  created_at timestamp
)

-- Questions table
questions (
  id uuid primary key,
  canonical_question text,
  pinecone_id text,  -- Reference to Pinecone vector
  cluster_id uuid,
  created_at timestamp
)

-- Question clusters table
question_clusters (
  id uuid primary key,
  name text,
  created_at timestamp
)

-- Question metrics table
question_metrics (
  id uuid primary key,
  question_id uuid references questions(id),
  video_id text references videos(id),
  frequency int,
  last_updated timestamp
)
```

#### Pinecone Structure
- Namespace: `youtube-questions`
- Vector dimension: 1536 (OpenAI embedding size)
- Metadata:
  - `question_id` (UUID)
  - `canonical_question` (text)
  - `cluster_id` (UUID)
  - `created_at` (timestamp)

### 3. Next.js Server Functions
1. **Server Functions**
   - `getChannelFAQs` - Get overall channel FAQs
   - `getVideoFAQs` - Get video-specific FAQs
   - `filterQuestions` - Filter questions by date/video
   - `getQuestionDetails` - Get detailed view of a question
   - `processNewComments` - Background processing
   - `updateQuestionClusters` - Periodic clustering

2. **Processing Services**
   - Use Supabase Edge Functions for background jobs
   - Implement caching using Next.js cache
   - Set up webhooks for real-time updates

### 4. Frontend Components
1. **Pages**
   - `/faq` - FAQ Overview Page
   - `/faq/[questionId]` - Question Detail Page
   - `/videos/[videoId]/faq` - Video-specific FAQ Page

2. **Components**
   - Question List Component
   - Filter Controls
   - Question Detail View
   - Loading States
   - Error Handling

3. **State Management**
   - Use React Query for server state
   - Implement optimistic updates
   - Handle loading and error states

### 5. UI/UX Features
1. **Filtering System**
   - Date range picker
   - Video selector dropdown
   - Search/filter by question text
   - Sort options

2. **Visualization**
   - Question frequency charts
   - Timeline view
   - Heat map of question distribution

3. **Navigation**
   - Breadcrumb navigation
   - Quick filters
   - Back to overview links

## PLAN

0. ✅ Read this document
1. ✅ Set up database structure (Supabase tables and Pinecone namespace)
2. ✅ Implement comment fetching and processing pipeline
3. ✅ Create question detection and clustering system
4. ✅ Build server functions for FAQ retrieval and filtering
5. ✅ Develop FAQ overview and detail pages
6. Implement filtering and visualization features
7. Set up real-time updates and error handling
8. Optimize performance and add tests