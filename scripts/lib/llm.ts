import { OpenAI } from "openai";

/**
 * Thin, swappable LLM wrapper.
 *
 * The whole "does this transcript answer the question, and where exactly?"
 * step goes through here. It is deliberately the only place that talks to a
 * model — to switch from OpenAI to Claude (or anything else), you only have to
 * reimplement `chatJson` below; nothing else in the spike changes.
 */

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to a .env file (see .env.example)."
    );
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

/**
 * Send a system + user prompt and parse the model's reply as JSON.
 * Uses JSON mode so the response is always a single JSON object.
 */
export async function chatJson<T>(opts: {
  system: string;
  user: string;
  model: string;
}): Promise<T> {
  const openai = getClient();

  const messages = [
    { role: "system" as const, content: opts.system },
    { role: "user" as const, content: opts.user },
  ];

  // Prefer deterministic output, but some newer models (GPT-5.x) only allow the
  // default temperature — fall back gracefully if temperature is rejected.
  let response;
  try {
    response = await openai.chat.completions.create({
      model: opts.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages,
    });
  } catch (error) {
    if (!isUnsupportedTemperature(error)) throw error;
    response = await openai.chat.completions.create({
      model: opts.model,
      response_format: { type: "json_object" },
      messages,
    });
  }

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(
      `Model did not return valid JSON. First 500 chars:\n${content.slice(0, 500)}`
    );
  }
}

function isUnsupportedTemperature(error: unknown): boolean {
  const err = error as { param?: string; message?: string };

  return err?.param === "temperature" || /temperature/i.test(err?.message ?? "");
}
