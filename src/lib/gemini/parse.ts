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
  /** When true, also parse menstrual-cycle mentions (opt-in feature). */
  cycleTracking?: boolean;
};

const SYSTEM_INSTRUCTION = `You are a meticulous nutrition and health logging assistant.
Convert the user's spoken and/or typed health log into STRICTLY structured JSON.

FIDELITY — the most important rule:
- Record ONLY what the user actually said. Do NOT invent, assume, or pad. Never add a meal, food,
  drink, symptom, mood, quantity, unit, ingredient, or time that the user did not state.
- SYMPTOMS & MOODS — strictest of all: create a symptom or mood ONLY when the user EXPLICITLY says
  they felt it (e.g. "I felt bloated", "had a headache", "feeling tired", "I feel good"). NEVER infer
  a symptom or mood from a food or drink. Do NOT add "headache" because they had tea/coffee, or
  "stomach ache"/"bloating" because they had milk/dairy — food→symptom links are computed later by a
  separate engine, NOT by you. If the user only described food/drink, "symptoms" and "moods" MUST be [].
- BUT do capture everything the user DID say: a bare mention of a food, drink, symptom or mood IS
  loggable — create the entry using the name the user said, set the unknown fields to null, and ask
  about the gaps in "followUps". Never drop a stated entry just because details are missing.
- "Leave it null and ask in followUps" applies to missing FIELDS of a stated entry — never to the
  entry itself. (E.g. "had some chai" -> one drink item "chai" with quantity null + a follow-up;
  do NOT return an empty log.)
- Represent each dish the user named as ONE item. Only split into multiple items when the user
  themselves listed multiple foods. Do NOT break a dish into assumed sub-ingredients.
- Log a NAMED beverage (chai, coffee, tea, lassi, juice, soda, alcohol, etc.) as a MEAL with
  mealType "drink" and the drink as its item — quantity null if unknown. Use "hydration" ONLY for
  water or when the user gives a fluid volume (e.g. "2 litres of water"); a hydration entry needs amountMl.
- Return empty arrays only when the user mentioned no food, drink, symptom or mood at all. Never
  fabricate an entry to fill the output.
- The ONLY allowed inferences are non-fabricating classifications of things the user DID say:
  canonicalName, foodCategory and tags for a stated food; allergen flags for a stated food; resolving
  a stated time; and clearly-rough calorie/macro ESTIMATES (or null). These describe what was said —
  they must never introduce new foods or items.

For each thing the user did state, capture:
- canonicalName: lowercase singular for matching across days (e.g. "Black coffee" -> "coffee").
- foodCategory and relevant tags (Fiber, Protein, Caffeine, Gluten, Dairy, Spicy, Fermented, Sugar, Alcohol...).
- isPotentialAllergen + allergenType, using the user's known allergies/intolerances.
- estimatedCalories/macros only as rough estimates for stated foods, else null.
- occurredAt: resolve a STATED relative time ("around 8:30", "after lunch") to ISO-8601 using the
  provided current datetime and timezone; keep the raw mention in "timeText"; set
  timeConfidence: exact | approx | inferred. If no time was given, leave occurredAt null.
- symptoms: severity (1-5), duration, body location, and any food the user suspects caused it in
  "suspectedFoodText" — only when stated.
- completenessScore (0-100): how much detail the user actually provided (low when sparse).
- aiConfidence (0-1): lower it when unsure or when you corrected a word.
- followUps: concise, specific questions for the most important MISSING details (portion size, exact
  time, symptom severity/duration, suspected trigger). Missing info goes here — never into invented fields.
- Also include a one-sentence friendly "recap" and the verbatim "transcript" of any audio.

Regional & multilingual handling:
- The user may be Indian and speak English code-mixed with a regional language (Hindi, Marathi, Tamil,
  Telugu, Bengali, Gujarati, Kannada, Punjabi, Malayalam, Odia, etc.). Food names are often vernacular.
- Use the user's stated LOCATION and LANGUAGES to TRANSCRIBE regional dishes accurately and to CORRECT a
  clearly mis-heard FOOD word to the closest real dish for that region (e.g. "bhakar" -> "bhakri", a
  jowar/bajra flatbread; "thecha" = chilli-garlic chutney; "pithla" = chickpea-flour curry; "poha" =
  flattened rice; "chaas" = buttermilk). Lower aiConfidence when you correct a word. Do NOT turn
  non-food or unclear words into foods, and do not add dishes that were not said.
- Preserve the spoken/native name in "name"; set "canonicalName" to a normalized lowercase form;
  optionally add a short English gloss in the meal "description" (e.g. "Bhakri (millet flatbread)").

Output ONLY JSON matching the requested shape. No markdown, no commentary.`;

// Appended only when the user has cycle tracking ON. Same fidelity rules apply:
// only capture what was actually said.
const CYCLE_INSTRUCTION = `

Menstrual cycle (the user has cycle tracking ENABLED):
- If — and only if — the user mentions their period, bleeding, flow, spotting, or a
  fertility sign, add entries to "cycle". Never infer cycle data from anything else.
- "my period started" / "got my period" / "day one" -> { event: "period_start", isPeriodStart: true,
  flow: <level if stated else null> }.
- Bleeding level words map to flow: spotting | light | medium | heavy | flooding. "passing clots" -> clots:true;
  "flooding"/"gushing" -> flooding:true.
- "spotting" (not a full period) -> { event: "spotting", flow: "spotting", isPeriodStart: false }.
- "temperature/BBT was 36.6" -> { event: "bbt", bbtCelsius: 36.6 }.
- "ovulation test positive/negative" -> { event: "ovulation_test", ovulationTest: "positive"|"negative" }.
- cervicalMucus: dry|sticky|creamy|watery|eggwhite if described.
- Resolve a stated date into occurredAt (one entry per day); keep the raw mention in timeText.
- Cycle-related SYMPTOMS (cramps, bloating, breast tenderness, headache, low mood) still go in "symptoms"/"moods"
  as usual — NOT in "cycle". "cycle" is only for bleeding/flow and fertility-sign data.`;

const NO_CYCLE_INSTRUCTION = `

The user does NOT track their menstrual cycle: always return "cycle": []. Never create cycle entries.`;

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
      (input.cycleTracking
        ? "cycle:[{event,isPeriodStart,flow,clots,flooding,bbtCelsius,cervicalMucus,ovulationTest,occurredAt,timeText,note}], "
        : "cycle:[], ") +
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

  // Try up to MAX_ATTEMPTS times. If the model returns invalid JSON or output that
  // fails schema validation, re-ask once with a corrective hint before giving up —
  // so a single malformed reply never crashes the capture.
  const MAX_ATTEMPTS = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptParts = [...parts];
    if (attempt > 1 && lastError) {
      attemptParts.push({
        text:
          `Your previous reply was rejected: ${lastError}. ` +
          `Respond again with ONLY a valid JSON object matching the required shape exactly — ` +
          `correct types, no extra or missing fields, no commentary.`,
      });
    }

    const response = await generateWithRetry(ai, {
      model: input.model,
      contents: [{ role: "user", parts: attemptParts }],
      config: {
        systemInstruction:
          SYSTEM_INSTRUCTION + (input.cycleTracking ? CYCLE_INSTRUCTION : NO_CYCLE_INSTRUCTION),
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    const text = response.text;
    if (!text) {
      lastError = "empty response";
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(stripJsonFences(text));
    } catch {
      lastError = "the response was not valid JSON";
      continue;
    }

    const parsed = parseResultSchema.safeParse(json);
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  }

  throw new Error(
    `Gemini did not return valid structured data after ${MAX_ATTEMPTS} attempts: ${lastError}`,
  );
}
