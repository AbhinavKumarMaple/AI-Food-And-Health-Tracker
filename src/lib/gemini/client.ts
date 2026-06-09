import { GoogleGenAI } from "@google/genai";

/** Create a Gemini client for a given user's API key. */
export function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error("Missing Gemini API key");
  }
  return new GoogleGenAI({ apiKey });
}
