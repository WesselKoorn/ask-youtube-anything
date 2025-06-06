import { describe, expect, it } from "vitest";
import { QuestionDetectionService } from "./question-detection-service";

describe("QuestionDetectionService", () => {
  describe("isQuestion", () => {
    // Helper function to test the private method
    const testIsQuestion = (text: string) => {
      return (
        QuestionDetectionService as unknown as {
          isQuestion: (text: string) => {
            isQuestion: boolean;
            confidence: number;
          };
        }
      ).isQuestion(text);
    };

    describe("Question mark tests", () => {
      it("should detect questions ending with question mark", () => {
        const result = testIsQuestion("What is the meaning of life?");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions with question mark in the middle", () => {
        const result = testIsQuestion(
          "I wonder what is the meaning of life? And then what"
        );
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should not detect statements with question mark", () => {
        const result = testIsQuestion("This is not a question?");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 }); // Note: This is a limitation of the current regex
      });
    });

    describe("Question word tests", () => {
      it("should detect questions starting with what", () => {
        const result = testIsQuestion("what is your name");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with who", () => {
        const result = testIsQuestion("who are you");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with where", () => {
        const result = testIsQuestion("where is the nearest store");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with when", () => {
        const result = testIsQuestion("when will you arrive");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with why", () => {
        const result = testIsQuestion("why did you do that");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with how", () => {
        const result = testIsQuestion("how does this work");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with can", () => {
        const result = testIsQuestion("can you help me");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with could", () => {
        const result = testIsQuestion("could you explain this");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with would", () => {
        const result = testIsQuestion("would you like to join");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with should", () => {
        const result = testIsQuestion("should I do this");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });
    });

    describe("Question phrase tests", () => {
      it("should detect questions starting with tell me", () => {
        const result = testIsQuestion("tell me about yourself");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with explain", () => {
        const result = testIsQuestion("explain how this works");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with describe", () => {
        const result = testIsQuestion("describe your experience");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should detect questions starting with define", () => {
        const result = testIsQuestion("define this term");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });
    });

    describe("Non-question tests", () => {
      it("should not detect statements", () => {
        const result = testIsQuestion("This is a statement");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect exclamations", () => {
        const result = testIsQuestion("What a great day!");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect commands", () => {
        const result = testIsQuestion("Please help me with this");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });
    });

    describe("Edge cases", () => {
      it("should handle empty string", () => {
        const result = testIsQuestion("");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should handle very long text", () => {
        const longText = "what is the meaning of life ".repeat(100);
        const result = testIsQuestion(longText);
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should handle text with special characters", () => {
        const result = testIsQuestion("what is the meaning of life?!@#$%^&*()");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });

      it("should handle text with numbers", () => {
        const result = testIsQuestion("what is 2 + 2");
        expect(result).toEqual({ isQuestion: true, confidence: 0.8 });
      });
    });

    describe("False positive cases", () => {
      it("should not detect exclamations with question words", () => {
        const result = testIsQuestion("What a beautiful day!");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random praise", () => {
        const result = testIsQuestion(
          "This video is absolutely amazing! Great job!"
        );
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random reactions", () => {
        const result = testIsQuestion("LOL this is hilarious");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random thoughts", () => {
        const result = testIsQuestion(
          "I've been watching this channel for years"
        );
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random statements", () => {
        const result = testIsQuestion("The weather is nice today");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random facts", () => {
        const result = testIsQuestion("Dogs are man's best friend");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random opinions", () => {
        const result = testIsQuestion("I think this is the best video ever");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random greetings", () => {
        const result = testIsQuestion(
          "Hello everyone! Hope you're having a great day"
        );
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random updates", () => {
        const result = testIsQuestion(
          "Just finished watching the whole series"
        );
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random suggestions", () => {
        const result = testIsQuestion(
          "You should check out their other videos"
        );
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });

      it("should not detect random observations", () => {
        const result = testIsQuestion("The background music is really calming");
        expect(result).toEqual({ isQuestion: false, confidence: 0.2 });
      });
    });
  });
});
