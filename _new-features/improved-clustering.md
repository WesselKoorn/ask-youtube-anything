# Improved Clustering Implementation Guide

## Overview
This guide outlines the implementation of three key improvements to our question clustering system:
1. Text Preprocessing
2. Centroid-based Matching
3. LLM-based Canonical Questions

## Phase 1: Text Preprocessing

### Step 1: Create Text Preprocessing Service
Create a new file `api/services/text-preprocessing-service.ts`:
```typescript
export class TextPreprocessingService {
  private static readonly TIMESTAMP_REGEX = /\d{1,2}:\d{2}/g;
  private static readonly STOP_PHRASES = [
    /^hey\s+man/i,
    /^quick\s+question:/i,
    /^just\s+wondering/i,
    /^hi\s+there/i,
    /^excuse\s+me/i,
    /^sorry\s+to\s+bother/i,
    /^i\s+have\s+a\s+question/i,
    /^can\s+i\s+ask/i,
    /^i\s+was\s+wondering/i,
  ];

  static preprocessText(text: string): string {
    // Remove timestamps
    let processed = text.replace(this.TIMESTAMP_REGEX, '<TIMESTAMP>');
    
    // Remove stop phrases
    this.STOP_PHRASES.forEach(regex => {
      processed = processed.replace(regex, '');
    });
    
    // Trim whitespace and normalize
    return processed.trim().toLowerCase();
  }
}
```

### Step 2: Modify QuestionClusteringService
Update `api/services/question-clustering-service.ts`:
```typescript
import { TextPreprocessingService } from './text-preprocessing-service';

export class QuestionClusteringService {
  private static async getEmbedding(text: string): Promise<number[]> {
    const processedText = TextPreprocessingService.preprocessText(text);
    // Rest of the embedding code...
  }
}
```

## Phase 2: Centroid-based Matching

### Step 1: Create Cluster Centroids Table
Create new migration file `supabase/migrations/20250606000001_add_cluster_centroids.sql`:
```sql
CREATE TABLE IF NOT EXISTS cluster_centroids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID REFERENCES question_clusters(id) ON DELETE CASCADE,
    embedding vector(1536),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cluster_centroids_cluster_id ON cluster_centroids(cluster_id);
```

### Step 2: Add Centroid Management
Add to `api/services/question-clustering-service.ts`:
```typescript
private static async updateClusterCentroid(clusterId: string): Promise<void> {
  const supabase = await createAdminClient();
  
  // Get all questions in the cluster
  const { data: questions } = await supabase
    .from('questions')
    .select('pinecone_id')
    .eq('cluster_id', clusterId);
    
  // Get embeddings from Pinecone
  const embeddings = await Promise.all(
    questions.map(q => youtubeQuestionsIndex.fetch([q.pinecone_id]))
  );
  
  // Calculate centroid
  const centroid = this.calculateCentroid(embeddings);
  
  // Store centroid
  await supabase
    .from('cluster_centroids')
    .upsert({
      cluster_id: clusterId,
      embedding: centroid,
      last_updated: new Date().toISOString()
    });
}

private static calculateCentroid(embeddings: number[][]): number[] {
  return embeddings[0].map((_, i) => 
    embeddings.reduce((sum, e) => sum + e[i], 0) / embeddings.length
  );
}

private static async findSimilarQuestions(
  question: string,
  channelId: string,
  threshold: number = 0.7
): Promise<{ questionId: string; clusterId: string; similarity: number }[]> {
  const embedding = await this.getEmbedding(question);
  
  // Get all centroids for the channel
  const { data: centroids } = await supabase
    .from('cluster_centroids')
    .select('cluster_id, embedding')
    .eq('channel_id', channelId);
    
  // Calculate similarities
  const similarities = centroids.map(centroid => ({
    clusterId: centroid.cluster_id,
    similarity: this.cosineSimilarity(embedding, centroid.embedding)
  }));
  
  return similarities
    .filter(s => s.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
```

## Phase 5: LLM-based Canonical Questions

### Step 1: Add Canonical Question Field
Create new migration file `supabase/migrations/20250606000002_add_canonical_question.sql`:
```sql
ALTER TABLE question_clusters 
ADD COLUMN canonical_question TEXT,
ADD COLUMN last_canonical_update TIMESTAMP WITH TIME ZONE;
```

### Step 2: Create Canonical Question Service
Create new file `api/services/canonical-question-service.ts`:
```typescript
export class CanonicalQuestionService {
  static async generateCanonicalQuestion(clusterId: string): Promise<void> {
    const supabase = await createAdminClient();
    
    // Get all questions in the cluster
    const { data: questions } = await supabase
      .from('questions')
      .select('canonical_question')
      .eq('cluster_id', clusterId);
      
    // Generate canonical question using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Rewrite the following list of viewer questions as a single, general question that covers them all. Make it clear and concise, avoiding any specific details that might not apply to all cases:"
        },
        {
          role: "user",
          content: questions.map(q => q.canonical_question).join('\n')
        }
      ]
    });
    
    // Update cluster with new canonical question
    await supabase
      .from('question_clusters')
      .update({
        canonical_question: response.choices[0].message.content,
        last_canonical_update: new Date().toISOString()
      })
      .eq('id', clusterId);
  }
}
```

### Step 3: Integrate Canonical Question Generation
Update `api/services/question-clustering-service.ts`:
```typescript
private static async processQuestionsBatch(
  comments: Comment[]
): Promise<void> {
  // ... existing code ...
  
  // After adding a new question to a cluster
  if (similarQuestions.length > 0) {
    // Update metrics and comment as before
    
    // Check if we should regenerate canonical question
    const { data: cluster } = await supabase
      .from('question_clusters')
      .select('last_canonical_update')
      .eq('id', similarQuestions[0].clusterId)
      .single();
      
    const lastUpdate = new Date(cluster.last_canonical_update);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 24) { // Regenerate every 24 hours
      await CanonicalQuestionService.generateCanonicalQuestion(similarQuestions[0].clusterId);
    }
  }
}
```

## Implementation Checklist

### Phase 1: Text Preprocessing
- [✅] Read this document
- [✅] Create `api/services/text-preprocessing-service.ts`
- [✅] Add timestamp regex and stop phrases
- [✅] Implement preprocessText method
- [✅] Modify QuestionClusteringService to use preprocessing
- [ ] Test preprocessing with existing questions

### Phase 2: Centroid-based Matching
- [ ] Create migration for cluster_centroids table
- [ ] Add updateClusterCentroid method
- [ ] Add calculateCentroid method
- [ ] Modify findSimilarQuestions to use centroids
- [ ] Test centroid-based matching with existing clusters

### Phase 5: LLM-based Canonical Questions
- [ ] Create migration for canonical_question fields
- [ ] Create CanonicalQuestionService
- [ ] Implement generateCanonicalQuestion method
- [ ] Integrate canonical question generation into clustering process
- [ ] Test canonical question generation with existing clusters

## Testing Strategy
1. For each phase:
   - Test with a small set of existing questions
   - Verify the changes improve clustering
   - Monitor for any performance issues
2. After all phases:
   - Run a full re-clustering of existing questions
   - Compare results with previous clustering
   - Verify canonical questions are clear and accurate 