import { getGeminiClient } from "./client";
import { parseResultSchema, type ParseResult } from "./schema";

type GenAiClient = ReturnType<typeof getGeminiClient>;
type GenerateParams = Parameters<GenAiClient["models"]["generateContent"]>[0];

/** Call Gemini, retrying once on transient overload (503 / UNAVAILABLE). */
async function generateWithRetry(ai: GenAiClient, params: GenerateParams, attempts = 2) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (i < attempts - 1 && /503|unavailable|overloaded|high demand/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export type UserHealthContext = {
  timezone: string;
  knownAllergies?: string[];
  intolerances?: string[];
  chronicConditions?: string[];
  dietaryPattern?: string | null;
  location?: string | null;
  languages?: string[];
};

export type ParseLogInput = {
  apiKey: string;
  model: string;
  /** Recorded audio as base64 (no data: prefix). */
  audioBase64?: string | null;
  audioMime?: string | null;
  /** Text the user typed to accompany / correct the recording. */
  typedText?: string | null;
  /** Current instant the log refers to (defaults handled by caller). */
  now: Date;
  user: UserHealthContext;
};

const SYSTEM_INSTRUCTION = `You are a meticulous nutrition and health logging assistant.
Convert the user's spoken and/or typed health log into STRICTLY structured JSON.

Goals:
- Capture as MUCH detail as possible. Split meals into individual food items.
- For every food item, set a lowercase singular "canonicalName" for matching across days
  (e.g. "Black coffee" -> "coffee", "Blueberries" -> "blueberry"), a "foodCategory",
  and relevant "tags" (Fiber, Protein, Caffeine, Gluten, Dairy, Spicy, Fermented, Sugar, Alcohol...).
- Flag likely allergens (isPotentialAllergen + allergenType) using the user's known allergies/intolerances.
- Estimate calories and macros when reasonably possible; otherwise omit.
- Resolve relative times ("around 8:30", "after lunch") into ISO-8601 "occurredAt"
  using the provided current datetime and timezone. Keep the raw mention in "timeText".
  Set timeConfidence: exact | approx | inferred.
- For symptoms, capture severity (1-5), duration, body location, and — crucially — any food
  the user suspects caused it, in "suspectedFoodText".
- Score each entry's "completenessScore" (0-100) based on how much useful detail is present.
- Generate concise, specific "followUps": questions that would fill the most important missing
  details (portion size, exact time, symptom severity/duration, suspected trigger). Reference the
  entry via targetType + targetIndex.
- Also include a one-sentence friendly "recap" and the verbatim "transcript" of any audio.

Regional & multilingual handling (important):
- The user may be Indian and speak English code-mixed with a regional language (Hindi, Marathi, Tamil,
  Telugu, Bengali, Gujarati, Kannada, Punjabi, Malayalam, Odia, etc.). Food names are often vernacular.
- Use the user's stated LOCATION and LANGUAGES to accurately TRANSCRIBE regional dishes AND to CORRECT
  likely mis-hearings phonetically. Examples: "bhakar"/"bhakri" = a jowar/bajra flatbread similar to roti
  (Maharashtra); "thecha" = spicy chilli-garlic chutney; "pithla" = chickpea-flour curry; "poha" = flattened
  rice; "upma" = semolina; "dal" = lentils; "sabzi" = vegetable dish; "chaas" = buttermilk.
- Preserve the dish's spoken/native name in the item "name"; set "canonicalName" to a normalized lowercase
  form; when helpful, add a short English gloss in the meal "description" (e.g. "Bhakri (millet flatbread)").
- Infer ingredients, foodCategory and tags from the dish (bhakri → millet flatbread → grain, Fiber;
  thecha → chilli+garlic → Spicy; dal → lentils → Protein; dahi/curd → Dairy).
- If a word is ambiguous or sounds mis-transcribed, prefer the closest real Indian dish for the user's
  region and lower the "aiConfidence" for that item.

Output ONLY JSON matching the requested shape. No markdown, no commentary.`;

function buildContextText(input: ParseLogInput): string {
  const { now, user, typedText } = input;
  const lines = [
    `Current datetime (ISO): ${now.toISOString()}`,
    `User timezone: ${user.timezone}`,
  ];
  if (user.knownAllergies?.length)
    lines.push(`Known allergies: ${user.knownAllergies.join(", ")}`);
  if (user.intolerances?.length)
    lines.push(`Intolerances: ${user.intolerances.join(", ")}`);
  if (user.chronicConditions?.length)
    lines.push(`Chronic conditions: ${user.chronicConditions.join(", ")}`);
  if (user.dietaryPattern) lines.push(`Dietary pattern: ${user.dietaryPattern}`);
  if (user.location) lines.push(`User location/region: ${user.location}`);
  if (user.languages?.length)
    lines.push(`Languages the user mixes when speaking: ${user.languages.join(", ")}`);
  lines.push("");
  lines.push(
    "Required JSON shape (use null/[] when unknown): { transcript, recap, " +
      "meals:[{mealType,title,description,occurredAt,timeText,timeConfidence,location,restaurantName," +
      "socialContext,hungerBefore,fullnessAfter,preparation,portionSize,estimatedCalories," +
      "macros:{protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg}," +
      "items:[{name,canonicalName,quantity,unit,foodCategory,tags,isPotentialAllergen,allergenType,estimatedCalories}]," +
      "completenessScore,aiConfidence,notes}], " +
      "symptoms:[{symptomType,title,severity,occurredAt,timeText,timeConfidence,durationMinutes,isOngoing," +
      "bodyLocation,description,suspectedFoodText,completenessScore,aiConfidence}], " +
      "moods:[{rating,label,occurredAt,timeText,energyLevel,stressLevel,notes}], " +
      "hydration:[{amountMl,beverageType,occurredAt,timeText}], " +
      "followUps:[{targetType,targetIndex,questionText,fieldHint}] }",
  );
  if (typedText?.trim()) {
    lines.push("");
    lines.push(`User typed note: """${typedText.trim()}"""`);
  }
  return lines.join("\n");
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}

/**
 * Send the recorded audio and/or typed text to Gemini and return a validated,
 * structured ParseResult. Throws on auth errors or unparseable output.
 */
export async function parseLogSession(
  input: ParseLogInput,
): Promise<ParseResult> {
  const ai = getGeminiClient(input.apiKey);

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: buildContextText(input) }];

  if (input.audioBase64 && input.audioMime) {
    parts.push({
      inlineData: { mimeType: input.audioMime, data: input.audioBase64 },
    });
    parts.push({
      text: "Transcribe the audio above and parse it together with the typed note.",
    });
  } else if (!input.typedText?.trim()) {
    throw new Error("Nothing to parse: provide audio or text.");
  }

  const response = await generateWithRetry(ai, {
    model: input.model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  let json: unknown;
  try {
    json = JSON.parse(stripJsonFences(text));
  } catch {
    throw new Error("Gemini response was not valid JSON.");
  }

  const parsed = parseResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Gemini response did not match the expected shape: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
