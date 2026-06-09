// Research-backed clinical knowledge used to make the statistical engine smarter:
//  1. Per-symptom analysis windows grounded in physiological onset times.
//  2. A catalogue of established diet→symptom mechanisms, used to flag a detected
//     correlation as biologically plausible and explain *why* it may occur.
//
// Sources (onset windows): lactose 0.5–2 h; FODMAP/fructose 2–8 h; caffeine peak
// 1–2 h (sleep effects later); tyramine/histamine migraine 1–24 h; reflux 0.5–2 h;
// gluten/NCGS 2–24 h. See the leading food-diary tools' 1–72 h (default 24 h) window.

/** Default look-back window (hours) for each symptom type, physiologically tuned. */
const SYMPTOM_WINDOW_HOURS: Record<string, number> = {
  heartburn: 3,
  reflux: 3,
  bloating: 6,
  gas: 6,
  cramps: 8,
  diarrhea: 8,
  nausea: 6,
  constipation: 24,
  headache: 24,
  migraine: 24,
  skin: 24,
  hives: 24,
  congestion: 12,
  fatigue: 12,
  mood: 12,
  anxiety: 8,
  insomnia: 16,
  sleep: 16,
  palpitations: 6,
};

export const DEFAULT_WINDOW_HOURS = 6;

export function windowHoursFor(symptomType: string): number {
  return SYMPTOM_WINDOW_HOURS[symptomType?.toLowerCase()] ?? DEFAULT_WINDOW_HOURS;
}

export type KnownTrigger = {
  id: string;
  /** Lowercase substrings matched against a food's canonical name / category / tags. */
  keywords: string[];
  /** Symptom types this trigger is associated with (lowercase). */
  symptoms: string[];
  /** Short mechanism shown to the user. */
  mechanism: string;
  /** Typical onset description. */
  onset: string;
};

export const KNOWN_TRIGGERS: KnownTrigger[] = [
  {
    id: "lactose",
    keywords: ["milk", "yogurt", "cheese", "cream", "butter", "dairy", "lactose", "ice cream", "latte"],
    symptoms: ["bloating", "gas", "diarrhea", "cramps", "nausea"],
    mechanism: "Lactose (dairy sugar) — common in lactose intolerance",
    onset: "30 min–2 h",
  },
  {
    id: "fodmap",
    keywords: ["apple", "pear", "mango", "honey", "onion", "garlic", "legume", "bean", "lentil", "chickpea", "cashew", "watermelon", "agave", "fructose", "sweetener", "sorbitol", "xylitol"],
    symptoms: ["bloating", "gas", "cramps", "diarrhea", "nausea"],
    mechanism: "Fermentable carbs (FODMAPs) fermented by gut bacteria",
    onset: "2–8 h",
  },
  {
    id: "caffeine",
    keywords: ["coffee", "espresso", "caffeine", "energy drink", "cola", "tea", "matcha"],
    symptoms: ["anxiety", "palpitations", "insomnia", "sleep", "reflux", "heartburn", "headache"],
    mechanism: "Caffeine — a stimulant that can disrupt sleep and the gut",
    onset: "30 min–6 h (sleep effects later)",
  },
  {
    id: "alcohol",
    keywords: ["wine", "beer", "alcohol", "whisky", "vodka", "cocktail", "gin", "rum"],
    symptoms: ["headache", "migraine", "sleep", "insomnia", "reflux", "nausea"],
    mechanism: "Alcohol — vasodilation, dehydration and poor sleep",
    onset: "1–12 h",
  },
  {
    id: "tyramine",
    keywords: ["aged cheese", "cured", "salami", "pepperoni", "fermented", "soy sauce", "red wine", "kimchi", "sauerkraut", "smoked"],
    symptoms: ["migraine", "headache"],
    mechanism: "Tyramine in aged / fermented foods",
    onset: "1–24 h",
  },
  {
    id: "histamine",
    keywords: ["tomato", "eggplant", "spinach", "vinegar", "shellfish", "shrimp", "prawn", "chocolate", "fermented", "aged", "smoked"],
    symptoms: ["headache", "migraine", "hives", "skin", "congestion"],
    mechanism: "Histamine — can trigger headache, skin and congestion",
    onset: "30 min–12 h",
  },
  {
    id: "gluten",
    keywords: ["bread", "pasta", "wheat", "gluten", "barley", "rye", "cereal", "cracker"],
    symptoms: ["bloating", "fatigue", "mood", "cramps"],
    mechanism: "Gluten / wheat (non-celiac sensitivity)",
    onset: "2–24 h",
  },
  {
    id: "fatty-spicy",
    keywords: ["fried", "fatty", "greasy", "pizza", "burger", "spicy", "chili", "chilli", "curry", "fast food"],
    symptoms: ["heartburn", "reflux", "nausea"],
    mechanism: "Fatty / spicy food relaxes the valve to the stomach",
    onset: "30 min–2 h",
  },
  {
    id: "sugar",
    keywords: ["sugar", "candy", "dessert", "soda", "pastry", "cake", "cookie", "syrup"],
    symptoms: ["fatigue", "mood", "anxiety"],
    mechanism: "Rapid blood-sugar swing",
    onset: "1–4 h",
  },
];

export type PlausibleMatch = { mechanism: string; onset: string };

/**
 * Returns a mechanism/onset if a known trigger plausibly explains this
 * food→symptom pair, else null. `terms` should include the food's canonical
 * name, category and tags (any casing).
 */
export function plausibleMechanism(
  terms: string[],
  symptomType: string,
): PlausibleMatch | null {
  const haystack = terms.filter(Boolean).map((t) => t.toLowerCase());
  const symptom = symptomType?.toLowerCase();
  for (const trigger of KNOWN_TRIGGERS) {
    const symptomMatches = trigger.symptoms.some((s) => symptom.includes(s) || s.includes(symptom));
    if (!symptomMatches) continue;
    const foodMatches = haystack.some((term) =>
      trigger.keywords.some((kw) => term.includes(kw) || kw.includes(term)),
    );
    if (foodMatches) return { mechanism: trigger.mechanism, onset: trigger.onset };
  }
  return null;
}
