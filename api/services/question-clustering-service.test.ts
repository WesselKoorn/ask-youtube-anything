import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestionClusteringService } from './question-clustering-service';
import { TextPreprocessingService } from './text-preprocessing-service';

// Mock OpenAI and Pinecone
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      })
    }
  }))
}));

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: vi.fn().mockImplementation(() => ({
    Index: vi.fn().mockReturnValue({
      query: vi.fn().mockResolvedValue({
        matches: [
          {
            score: 0.85,
            metadata: {
              question_id: 'test-question-1',
              cluster_id: 'test-cluster-1'
            }
          }
        ]
      })
    })
  }))
}));

describe('QuestionClusteringService with Preprocessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find similar questions after preprocessing', async () => {
    const testCases = [
      {
        input: 'Hey man, at 1:30 in the video, how do I do this?',
        expected: 'at <timestamp> in the video, how do i do this?'
      },
      {
        input: 'Quick question: at 1:30, how do I do this?',
        expected: 'at <timestamp>, how do i do this?'
      }
    ];

    for (const testCase of testCases) {
      const similarQuestions = await QuestionClusteringService.findSimilarQuestions(
        testCase.input,
        'test-channel-id'
      );

      expect(similarQuestions).toHaveLength(1);
      expect(similarQuestions[0].similarity).toBeGreaterThan(0.7);
    }
  });

  it('should handle questions with different timestamps but same content', async () => {
    const question1 = 'At 1:30, how do I do this?';
    const question2 = 'At 2:45, how do I do this?';

    const similar1 = await QuestionClusteringService.findSimilarQuestions(
      question1,
      'test-channel-id'
    );
    const similar2 = await QuestionClusteringService.findSimilarQuestions(
      question2,
      'test-channel-id'
    );

    expect(similar1[0].clusterId).toBe(similar2[0].clusterId);
  });

  it('should handle questions with different stop phrases but same content', async () => {
    const question1 = 'Hey man, how do I do this?';
    const question2 = 'Quick question: how do I do this?';

    const similar1 = await QuestionClusteringService.findSimilarQuestions(
      question1,
      'test-channel-id'
    );
    const similar2 = await QuestionClusteringService.findSimilarQuestions(
      question2,
      'test-channel-id'
    );

    expect(similar1[0].clusterId).toBe(similar2[0].clusterId);
  });
}); 