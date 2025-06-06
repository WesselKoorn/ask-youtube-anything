import { describe, it, expect } from "vitest";
import { TextPreprocessingService } from "../../api/services/text-preprocessing-service";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@supabase/database.types";

describe("TextPreprocessingService Integration", () => {
  it("should preprocess real questions from the database", async () => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get some real questions from the database
    const { data: questions } = await supabase
      .from("comments")
      .select("content")
      .eq("is_question", true)
      .gt("question_confidence", 0.6)
      .limit(5);

    if (!questions || questions.length === 0) {
      console.log("No questions found in database, skipping test");
      return;
    }

    // Test preprocessing on each question
    for (const question of questions) {
      const processed = TextPreprocessingService.preprocessText(
        question.content
      );

      // Verify basic preprocessing rules
      expect(processed).toBeDefined();
      expect(processed).toBe(processed.toLowerCase()); // Should be lowercase
      expect(processed).not.toMatch(/\d{1,2}:\d{2}/); // Should not contain timestamps
      expect(processed).not.toMatch(/^hey\s+man/i); // Should not start with stop phrases
      expect(processed).not.toMatch(/^quick\s+question:/i);
      expect(processed).not.toMatch(/^just\s+wondering/i);

      // Log the before/after for manual review
      console.log("Original:", question.content);
      console.log("Processed:", processed);
      console.log("---");
    }
  });
});
