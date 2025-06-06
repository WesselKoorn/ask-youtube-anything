import { describe, it, expect } from 'vitest';
import { TextPreprocessingService } from './text-preprocessing-service';

describe('TextPreprocessingService', () => {
  describe('preprocessText', () => {
    it('should remove timestamps', () => {
      const input = 'Hey, at 12:30 in the video, how do I do this?';
      const expected = 'hey, at <timestamp> in the video, how do i do this?';
      expect(TextPreprocessingService.preprocessText(input)).toBe(expected);
    });

    it('should remove multiple timestamps', () => {
      const input = 'At 1:30 and 2:45, what is happening?';
      const expected = 'at <timestamp> and <timestamp>, what is happening?';
      expect(TextPreprocessingService.preprocessText(input)).toBe(expected);
    });

    it('should remove stop phrases', () => {
      const testCases = [
        {
          input: 'Hey man, how do I do this?',
          expected: ', how do i do this?'
        },
        {
          input: 'Quick question: what is this?',
          expected: 'what is this?'
        },
        {
          input: 'Just wondering if this works?',
          expected: 'if this works?'
        },
        {
          input: 'Hi there, can you help me?',
          expected: ', can you help me?'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(TextPreprocessingService.preprocessText(input)).toBe(expected);
      });
    });

    it('should handle multiple preprocessing steps', () => {
      const input = 'Hey man, at 1:30 in the video, quick question: how do I do this?';
      const expected = ', at <timestamp> in the video, quick question: how do i do this?';
      expect(TextPreprocessingService.preprocessText(input)).toBe(expected);
    });

    it('should normalize text', () => {
      const input = '  HOW do I DO this?  ';
      const expected = 'how do i do this?';
      expect(TextPreprocessingService.preprocessText(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      expect(TextPreprocessingService.preprocessText('')).toBe('');
    });

    it('should handle strings with only whitespace', () => {
      expect(TextPreprocessingService.preprocessText('   ')).toBe('');
    });
  });
}); 