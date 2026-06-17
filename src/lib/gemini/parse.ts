import { getGeminiClient } from "./client";
import { parseResultSchema, type ParseResult } from "./schema";

type GenAiClient = ReturnType<typeof getGeminiClient>;

/** Thrown when a model replies but its JSON fails our schema after retries. */
class SchemaError extends Error {}

/**
 * Models to fall back through when the selected model is overloaded (503),
 * rate-limited, or unavailable — tried in order, NEWEST FIRST ("from latest to
 * lower"), exactly as specified. IDs verified against the live ListModels API.
 * (gemini-2.5-flash-preview-tts is a speech model and will simply be skipped if
 * it can't structure text — kept here per the requested list.)
 */
const DEFAULT_FALLBACK_MODELS = [
  "gemini-3.5-flash", // Gemini 3.5 Flash
  "gemini-3.1-flash-lite", // Gemini 3.1 Flash Lite
  "gemini-3-flash-preview", // Gemini 3 Flash Preview
  "gemini-2.5-flash-lite", // Gemini 2.5 Flash-Lite
  "gemini-2.5-flash-preview-tts", // Gemini 2.5 Flash Preview TTS
  "gemini-2.5-flash", // Gemini 2.5 Flash
  "gemini-2.0-flash-lite-001", // Gemini 2.0 Flash-Lite 001
  "gemini-2.0-flash-lite", // Gemini 2.0 Flash-Lite
  "gemini-2.0-flash-001", // Gemini 2.0 Flash 001
  "gemini-2.0-flash", // Gemini 2.0 Flash
];

/** Ordered, de-duplicated list of models to try: selected first, then fallbacks. */
function buildModelChain(selected: string, provided?: string[]): string[] {
  const seen = new Set<string>();
  const chain: string[] = [];
  const add = (m?: string) => {
    const id = (m ?? "").trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      chain.push(id);
    }
  };
  add(selected);
  for (const m of provided && provided.length ? provided : DEFAULT_FALLBACK_MODELS) add(m);
  for (const m of DEFAULT_FALLBACK_MODELS) add(m); // always keep stable defaults as a last resort
  return chain;
}

/** Pull a short, human-readable reason out of a (often JSON) Gemini error. */
function cleanErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "unknown error");
  const m = raw.match(/"message"\s*:\s*"([^"]+)"/);
  return (m ? m[1] : raw).slice(0, 240);
}

/** A 429 quota/rate-limit error — an account/plan limit, NOT a per-model "busy". */
function isQuotaError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /\b429\b|resource_exhausted|exceeded your current quota|\bquota\b/.test(msg);
}

/** Seconds to wait, if the error suggests one ("retry in 19s" / retryDelay "19s"). */
function retryAfterSeconds(e: unknown): number | null {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const m = raw.match(/retry in ([\d.]+)s/i) ?? raw.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  return m ? Math.ceil(Number(m[1])) : null;
}

/** Auth / API-key errors won't be fixed by switching models — stop immediately. */
function isAuthError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /\b401\b|\b403\b|api[_ ]?key|unauthenticated|permission denied|forbidden|api key not valid|invalid authentication/.test(
    msg,
  );
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
  /** Extra models to try (in order) if the selected one is busy. Defaults used if omitted. */
  fallbackModels?: string[];
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

type ParsePart = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * Run ONE model: up to MAX_ATTEMPTS, re-asking with a corrective hint on invalid
 * JSON. Propagates the raw generate error (503/auth/etc.) to the caller so it can
 * decide whether to switch models; throws SchemaError if the model keeps
 * returning output that fails validation.
 */
async function runModel(
  ai: GenAiClient,
  model: string,
  systemInstruction: string,
  baseParts: ParsePart[],
): Promise<ParseResult> {
  const MAX_ATTEMPTS = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptParts = [...baseParts];
    if (attempt > 1 && lastError) {
      attemptParts.push({
        text:
          `Your previous reply was rejected: ${lastError}. ` +
          `Respond again with ONLY a valid JSON object matching the required shape exactly — ` +
          `correct types, no extra or missing fields, no commentary.`,
      });
    }

    // Any generate error (503 overload, 429, 404 model-not-found, auth) propagates.
    const callStart = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: attemptParts }],
      config: { systemInstruction, responseMimeType: "application/json", temperature: 0 },
    });
    console.log(`[parse]    ${model} attempt ${attempt} responded in ${Date.now() - callStart}ms`);

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

  throw new SchemaError(`schema validation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

/**
 * Send the recorded audio and/or typed text to Gemini and return validated,
 * structured output. Tries the selected model first; if it's overloaded (503),
 * rate-limited, or unavailable, it automatically falls back through other
 * flash / flash-lite models until one responds. Only an auth/key error stops it.
 * Returns which model actually produced the result.
 */
export async function parseLogSession(
  input: ParseLogInput,
): Promise<{ result: ParseResult; modelUsed: string }> {
  const ai = getGeminiClient(input.apiKey);

  const parts: ParsePart[] = [{ text: buildContextText(input) }];
  if (input.audioBase64 && input.audioMime) {
    parts.push({ inlineData: { mimeType: input.audioMime, data: input.audioBase64 } });
    parts.push({ text: "Transcribe the audio above and parse it together with the typed note." });
  } else if (!input.typedText?.trim()) {
    throw new Error("Nothing to parse: provide audio or text.");
  }

  const systemInstruction =
    SYSTEM_INSTRUCTION + (input.cycleTracking ? CYCLE_INSTRUCTION : NO_CYCLE_INSTRUCTION);
  const chain = buildModelChain(input.model, input.fallbackModels);

  const chainStart = Date.now();
  console.log(
    `[parse] selected="${input.model}" — fallback chain (${chain.length}): ${chain.join(" → ")}`,
  );

  let lastError: unknown;
  let lastModel = input.model;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const t0 = Date.now();
    console.log(`[parse] → [${i + 1}/${chain.length}] trying ${model}…`);
    try {
      const result = await runModel(ai, model, systemInstruction, parts);
      console.log(
        `[parse] ✓ ${model} succeeded in ${Date.now() - t0}ms (total ${Date.now() - chainStart}ms)`,
      );
      return { result, modelUsed: model };
    } catch (e) {
      lastError = e;
      lastModel = model;
      const ms = Date.now() - t0;
      // A bad key/permission won't improve on another model — fail fast.
      if (isAuthError(e)) {
        console.warn(`[parse] ✗ ${model} AUTH error in ${ms}ms — stopping: ${cleanErrorMessage(e)}`);
        throw e;
      }
      // Otherwise (503 overload, 429, 404, schema failure, transient) try the next.
      const kind = isQuotaError(e) ? "QUOTA/429" : e instanceof SchemaError ? "BAD-SCHEMA" : "BUSY/UNAVAILABLE";
      console.warn(
        `[parse] ✗ ${model} ${kind} in ${ms}ms — trying next: ${cleanErrorMessage(e)}`,
      );
    }
  }

  console.error(
    `[parse] ✗ ALL ${chain.length} models failed in ${Date.now() - chainStart}ms (last: ${lastModel})`,
  );

  // Every model failed. Quota (429) is an account/plan cap — switching models
  // can't help — so say that plainly rather than implying it's transient load.
  if (isQuotaError(lastError)) {
    const wait = retryAfterSeconds(lastError);
    throw new Error(
      `Your Gemini API quota is used up on every model — this is an account/plan limit, so switching models can't help. ` +
        (wait ? `Try again in ~${wait}s, ` : "Try again later, ") +
        `or check your Gemini API plan & billing (or use a key with available quota).`,
    );
  }
  throw new Error(
    `All models are busy right now (last tried ${lastModel}). Please try again in a moment. (${cleanErrorMessage(lastError)})`,
  );
}
