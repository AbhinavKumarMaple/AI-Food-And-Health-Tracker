// Fetch the list of available Gemini models directly from Google's REST API,
// so the Settings model-picker reflects exactly what the user's key can access.

export type GeminiModel = {
  name: string; // e.g. "models/gemini-2.0-flash"
  baseModelId: string; // e.g. "gemini-2.0-flash"
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods: string[];
};

type RawModel = {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * List models the key can use for content generation.
 * Throws with a helpful message on auth/quota errors.
 */
export async function listGeminiModels(apiKey: string): Promise<GeminiModel[]> {
  if (!apiKey) throw new Error("Missing Gemini API key");

  const all: GeminiModel[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(BASE);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 400 || res.status === 403) {
        throw new Error("Invalid or unauthorized Gemini API key.");
      }
      throw new Error(`Failed to list models (HTTP ${res.status}). ${body}`);
    }

    const data = (await res.json()) as {
      models?: RawModel[];
      nextPageToken?: string;
    };

    for (const m of data.models ?? []) {
      const name = m.name ?? "";
      all.push({
        name,
        baseModelId: name.replace(/^models\//, ""),
        displayName: m.displayName ?? name,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
        supportedGenerationMethods: m.supportedGenerationMethods ?? [],
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all
    .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
