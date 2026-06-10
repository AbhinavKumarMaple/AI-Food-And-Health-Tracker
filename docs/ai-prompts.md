# AI Prompts — Reference

A complete inventory of every prompt / instruction the app sends to an AI model,
where it lives, when it's sent, and what it does.

## TL;DR

- The app makes **one kind of LLM call**: a single **Gemini multimodal** request that
  **transcribes audio _and_ structures it into JSON in one shot** (`parseLogSession`).
- **The only AI prompt in the codebase is in [`src/lib/gemini/parse.ts`](../src/lib/gemini/parse.ts).**
  It has three pieces: a **system instruction**, a **dynamic context/user message**, and
  (when audio is present) a short **"transcribe" instruction**.
- **"Patterns detected" on the Stats screen is NOT AI** — it's deterministic statistics +
  templated sentences ([`src/lib/patterns/correlate.ts`](../src/lib/patterns/correlate.ts)).
- The **live on-screen transcript** uses the browser's **Web Speech API** (on-device ASR),
  configured in [`src/lib/useRecorder.ts`](../src/lib/useRecorder.ts). It's not a "prompt";
  Gemini's own audio transcription is the source of truth.
- **Model listing** ([`src/lib/gemini/models.ts`](../src/lib/gemini/models.ts)) is a plain REST
  call with no prompt.

---

## 1. Parse — System instruction

- **File:** `src/lib/gemini/parse.ts` → `SYSTEM_INSTRUCTION`
- **Sent as:** `config.systemInstruction`
- **When:** every log capture (audio and/or typed text)
- **Purpose:** defines the model's whole behaviour — split meals into items, canonicalize
  foods, flag allergens, estimate macros, resolve relative times, capture symptoms +
  suspected triggers, score completeness, generate follow-ups, handle regional Indian foods,
  and emit JSON only.

> **Anti-hallucination note:** an earlier version began with *"Capture as MUCH detail as possible"*
> and *"Infer ingredients… from the dish"*, which made the model **fabricate** foods/items the user
> never said. It now leads with a **FIDELITY** rule (record only what was said; route missing detail
> to `followUps`; never drop a stated entry either), and `temperature` is **0**.

**Verbatim (current):**

```text
You are a meticulous nutrition and health logging assistant.
Convert the user's spoken and/or typed health log into STRICTLY structured JSON.

FIDELITY — the most important rule:
- Record ONLY what the user actually said. Do NOT invent, assume, or pad. Never add a meal, food,
  drink, symptom, mood, quantity, unit, ingredient, or time that the user did not state.
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

Output ONLY JSON matching the requested shape. No markdown, no commentary.
```

---

## 2. Parse — Context / user message (dynamic)

- **File:** `src/lib/gemini/parse.ts` → `buildContextText()`
- **Sent as:** the **first `user` part** (text) in `contents`
- **When:** every capture
- **Purpose:** gives the model the per-request facts it needs (current time, the user's
  health + region context) and the exact **JSON shape** to return, plus the typed note.

**Lines added conditionally (only when the value exists):**

```text
Current datetime (ISO): <now.toISOString()>
User timezone: <timezone>
Known allergies: <comma list>            # if any
Intolerances: <comma list>               # if any
Chronic conditions: <comma list>         # if any
Dietary pattern: <text>                  # if set
User location/region: <text>             # if set
Languages the user mixes when speaking: <comma list>   # if any

Required JSON shape (use null/[] when unknown): { transcript, recap, meals:[{mealType,title,description,occurredAt,timeText,timeConfidence,location,restaurantName,socialContext,hungerBefore,fullnessAfter,preparation,portionSize,estimatedCalories,macros:{protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg},items:[{name,canonicalName,quantity,unit,foodCategory,tags,isPotentialAllergen,allergenType,estimatedCalories}],completenessScore,aiConfidence,notes}], symptoms:[{symptomType,title,severity,occurredAt,timeText,timeConfidence,durationMinutes,isOngoing,bodyLocation,description,suspectedFoodText,completenessScore,aiConfidence}], moods:[{rating,label,occurredAt,timeText,energyLevel,stressLevel,notes}], hydration:[{amountMl,beverageType,occurredAt,timeText}], followUps:[{targetType,targetIndex,questionText,fieldHint}] }

User typed note: """<typed text>"""      # if the user typed anything
```

**Example rendered (Maharashtra user, typed note):**

```text
Current datetime (ISO): 2026-06-10T08:30:00.000Z
User timezone: Asia/Kolkata
User location/region: Pune, Maharashtra, India
Languages the user mixes when speaking: Marathi, Hindi, English

Required JSON shape (use null/[] when unknown): { transcript, recap, meals:[...], symptoms:[...], moods:[...], hydration:[...], followUps:[...] }

User typed note: """two bhakar with thecha and pithla"""
```

---

## 3. Parse — Audio instruction part

- **File:** `src/lib/gemini/parse.ts` (inside `parseLogSession`)
- **Sent as:** a `user` text part, **after** the inline audio data
- **When:** only when recorded audio is attached
- **Verbatim:**

```text
Transcribe the audio above and parse it together with the typed note.
```

---

## 4. Parse — request assembly & generation config

The full request Gemini receives (`ai.models.generateContent`):

```jsonc
{
  "model": "<user-selected, default gemini-2.5-flash-lite>",
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "<context/user message from §2>" },
        { "inlineData": { "mimeType": "audio/webm", "data": "<base64 audio>" } }, // if audio
        { "text": "Transcribe the audio above and parse it together with the typed note." } // if audio
      ]
    }
  ],
  "config": {
    "systemInstruction": "<§1 system instruction>",
    "responseMimeType": "application/json",
    "temperature": 0
  }
}
```

- **Model:** chosen per-user in Settings (Google `ListModels`); default `gemini-2.5-flash-lite`.
- **JSON mode:** `responseMimeType: "application/json"`.
- **Temperature:** `0` (maximally faithful / deterministic structuring).
- **Resilience:** `generateWithRetry()` retries **once** on transient `503 / UNAVAILABLE /
  overloaded / high demand`, after `1200 ms`.
- **Validation:** the response is stripped of code fences and validated with the **zod**
  schema in [`src/lib/gemini/schema.ts`](../src/lib/gemini/schema.ts) before use (the schema is
  the contract, not a prompt).

---

## 5. Browser live transcript (Web Speech API) — not a prompt

- **File:** `src/lib/useRecorder.ts`
- **What:** on-device speech recognition used **only** for the live transcript shown on the
  Record screen. Config: `continuous = true`, `interimResults = true`,
  `lang = <en-IN or a regional code> || navigator.language`.
- **Note:** this is a separate ASR engine; the **authoritative** transcription is Gemini's
  (from the audio in §4). The locale is derived from the user's profile languages
  (`speechLangFor` in `src/app/record/page.tsx`), defaulting to `en-IN`.

---

## 6. Model list — not a prompt

- **File:** `src/lib/gemini/models.ts` → `listGeminiModels()`
- **What:** REST `GET https://generativelanguage.googleapis.com/v1beta/models` with the
  user's key; filters to models supporting `generateContent`. No prompt text.

---

## 7. "Patterns detected" insights — NOT AI

- **File:** `src/lib/patterns/correlate.ts` → `correlationsToInsights()`
- **What:** the food→symptom insight sentences on the Stats screen are produced by a
  **deterministic statistical engine** (lift, binomial significance, FDR) + **string
  templates** — there is no LLM call here. The "AI"-looking copy is generated from the stats.

---

## Where to edit (quick map)

| To change… | Edit |
|---|---|
| Overall model behaviour / rules | `SYSTEM_INSTRUCTION` in `src/lib/gemini/parse.ts` |
| Per-request facts sent to the model | `buildContextText()` in `src/lib/gemini/parse.ts` |
| The JSON shape the model returns | the "Required JSON shape" line in `buildContextText()` **and** the zod schema in `src/lib/gemini/schema.ts` |
| Audio handling instruction | the `"Transcribe the audio above…"` part in `parseLogSession()` |
| Temperature / JSON mode / retries | the `config` + `generateWithRetry` in `parse.ts` |
| Live-transcript language | `speechLangFor()` in `src/app/record/page.tsx` + `useRecorder.ts` |
| Insight wording (non-AI) | `correlationsToInsights()` in `src/lib/patterns/correlate.ts` |
