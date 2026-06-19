import { OpenAI } from "openai";

/**
 * Thin embedding + similarity helpers for the retrieval-based matcher.
 * Embeddings go through OpenAI's text-embedding-3-large; switching providers
 * means reimplementing embedTexts() and nothing else.
 */

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (see .env.example).");
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** Embed texts in batches, preserving input order. */
export async function embedTexts(
  texts: string[],
  model = "text-embedding-3-large"
): Promise<number[][]> {
  const openai = getClient();
  const out: number[][] = [];
  const BATCH = 128;
  for (let i = 0; i < texts.length; i += BATCH) {
    const input = texts
      .slice(i, i + BATCH)
      .map((t) => t.replace(/\s+/g, " ").trim().slice(0, 8000) || " ");
    const res = await openai.embeddings.create({ model, input });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(d.embedding as number[]);
  }
  return out;
}

/** Cosine similarity between two equal-length vectors. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
