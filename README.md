# Ask YouTube Anything

Ask YouTube Anything is an AI-powered application that allows users to ask questions about YouTube videos and get intelligent responses based on the video content. The application uses advanced AI models to transcribe, understand, and answer questions about YouTube videos in real-time.

## Features

- 🔍 Search and select any YouTube video
- 💬 Ask questions about the video content
- 🤖 Get AI-powered responses based on the video's content
- 📱 Modern, responsive UI
- ⚡ Real-time chat interface
- 🔒 Secure authentication with Supabase

## System Overview

### 1. Core Purpose
- Transform YouTube videos into an interactive Q&A system
- Automatically identify and organize viewer questions
- Provide AI-powered answers based on video content

### 2. Main Components

#### A. Content Processing Pipeline
1. **Video Ingestion**
   - Fetch latest videos from a channel
   - Extract transcripts
   - Store in vector database (Pinecone) for semantic search
   - Why? To enable context-aware answers based on video content

2. **Comment Analysis**
   - Collect all channel comments
   - Identify questions using AI classification
   - Why? To understand what viewers are asking about

3. **Question Organization**
   - Group similar questions using semantic similarity
   - Create canonical questions for each group
   - Track question frequency and patterns
   - Why? To identify common viewer concerns and create comprehensive FAQs

#### B. Question Answering System
1. **Question Processing**
   - Convert user question to vector embedding
   - Find relevant video segments using semantic search
   - Why? To ensure answers are based on actual video content

2. **Answer Generation**
   - Use relevant video segments as context
   - Generate AI response using the context
   - Why? To provide accurate, video-specific answers

### 3. Key Business Logic

#### A. Question Detection
- Uses OpenAI to classify comments as questions
- Assigns confidence scores (0-1)
- Only processes comments with confidence > 0.6
- Why? To filter out non-questions and ensure quality

#### B. Question Clustering
- Converts questions to vector embeddings
- Groups questions based on semantic similarity
- Creates canonical questions for each cluster
- How it works:
  1. New question is embedded
  2. Searches for similar existing questions
  3. If similarity > threshold:
     - Adds to existing cluster
     - Updates frequency metrics
  4. If no similar questions:
     - Creates new cluster
     - Sets as canonical question
- Why? To identify patterns in viewer questions

#### C. FAQ Generation
- Automatically organizes questions into a searchable FAQ system
- Features:
  1. Question Clustering
     - Groups similar questions using semantic similarity
     - Maintains canonical questions for each cluster
     - Tracks question frequency across videos
  2. Rich Metadata
     - Tracks when questions were asked
     - Records question frequency
     - Links questions to specific videos
  3. Advanced Filtering
     - Filter by video
     - Filter by date range
     - Filter by minimum frequency
     - Search by question text
  4. Related Questions
     - Shows similar questions in the same cluster
     - Displays original comments that asked the question
     - Tracks question evolution over time
- Why? To provide a comprehensive, organized view of viewer questions and concerns

### 4. Data Flow
```
YouTube Channel
    ↓
[Video Processing]
    ↓
Pinecone (Vector DB)
    ↓
[Question Processing]
    ↓
Supabase (Structured DB)
    ↓
[Answer Generation]
    ↓
User Interface
```

## Tech Stack

- **Frontend**: Next.js 15 with React 19
- **Backend**: Next.js API Routes
- **Database**: Supabase
- **Vector Database**: Pinecone
- **AI**: OpenAI GPT-4
- **Styling**: SASS
- **Testing**: Vitest
- **Analytics**: Vercel Analytics

## Prerequisites

Before you begin, ensure you have the following:
- Node.js (Latest LTS version recommended)
- npm or yarn
- A Supabase account and project
- A Pinecone account and API key
- An OpenAI API key

## Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ask-youtube-anything.git
cd ask-youtube-anything
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file in the root directory with the following variables:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=your_pinecone_index_name

# YouTube Configuration
YOUTUBE_DATA_API_KEY=your_youtube_data_api_key
```

## Development

To start the development server:

```bash
npm run dev
# or
yarn dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── app/                    # Next.js app directory
├── api/                    # API routes and endpoints
│   ├── services/         # Core business logic and external service integrations
│   └── *.test.ts        # API endpoint tests
├── components/            # Reusable React components
├── lib/                   # Utility functions and shared logic
│   └── supabase/        # Supabase client and utilities
├── models/               # Type definitions and interfaces
├── styles/              # Global styles and SASS files
├── supabase/           # Database migrations and types
└── public/             # Static assets
```

## Testing

The project uses Vitest for testing. To run tests:

```bash
npm run test
# or
yarn test
```

Write tests for:
- Utility functions
- API endpoints
- Complex business logic

## Deployment

The application is configured for deployment on Vercel. To deploy:

1. Push your changes to the main branch
2. Vercel will automatically deploy the changes
3. Monitor the deployment in the Vercel dashboard
