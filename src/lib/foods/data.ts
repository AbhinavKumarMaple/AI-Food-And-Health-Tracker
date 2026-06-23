// Dose-aware low-FODMAP food reference, India-first.
//
// Base classification was transcribed from the Gastroenterology Consultants of
// San Antonio "Low FODMAP Diet" chart, then upgraded to be DOSE-AWARE (FODMAP is
// portion-dependent): a binary low/high hides that small serves of many "high"
// foods are fine and large serves of "low" foods are not. So each food carries a
// 3-level status (green/amber/red) keyed to a serving, its dominant FODMAP, an
// India-first safe serve + swap, prep caveats, and a data-confidence marker.
//
// Serving amounts are HOUSEHOLD terms only (no invented gram figures); exact
// thresholds are Monash University lab data and vary by person. Indian-specific
// foods that Monash hasn't lab-tested (paneer, chaas, jaggery, composite dishes)
// are marked confidence "guidance" — directional, not certain.
//
// This is a reference, NOT medical advice. Tolerance is personal.

export type FodmapStatus = "green" | "amber" | "red";
// green = low-FODMAP at a normal serve · amber = low only in a small serve, high above it · red = high FODMAP at typical serves, commonly poorly tolerated

export type Confidence = "tested" | "estimated" | "guidance";
// tested = Monash/published lab value · estimated = inferred from a close analogue · guidance = not lab-tested (often Indian-specific) — treat as directional

export interface FoodItem {
  name: string; // canonical English name
  status: FodmapStatus;
  dominantFodmap?: string; // the single "why" tag; omitted for FODMAP-free staples
  category: string; // Fruit | Vegetable | Legume | Dairy | Dairy alt | Grain | Fibre | Sweetener | Spice | Fat
  safeServe?: string; // the green/amber serve, household terms
  limitServe?: string; // the serve at which it turns high
  swap?: string; // India-first low-FODMAP substitute
  prepNote?: string; // ripeness/cooking/processing caveat that can flip the verdict
  confidence: Confidence;
  aliases: string[]; // synonyms + Indian/regional names
  note?: string;
}

export const FOOD_SOURCE =
  "Base list: Gastroenterology Consultants of San Antonio (gastroconsa.com); dose/serving guidance per Monash University FODMAP research.";

/** Normalized key linking a food (or a user's custom food) to its personal note. */
export const foodKey = (name: string): string => name.trim().toLowerCase();

export const FOODS: FoodItem[] = [
  // ───────────────────────── Excess fructose ─────────────────────────
  { name: "Apple", status: "red", dominantFodmap: "Excess fructose & sorbitol", category: "Fruit", swap: "orange, kiwi or a firm banana", confidence: "tested", aliases: ["seb", "सेब"] },
  { name: "Mango", status: "red", dominantFodmap: "Excess fructose", category: "Fruit", swap: "small serve of papaya, pineapple or orange", confidence: "tested", aliases: ["aam", "आम"] },
  { name: "Pear", status: "red", dominantFodmap: "Fructose & sorbitol", category: "Fruit", swap: "orange or kiwi", confidence: "tested", aliases: ["nashpati", "नाशपाती", "babbugosha"] },
  { name: "Nashi pear", status: "red", dominantFodmap: "Sorbitol & fructose", category: "Fruit", swap: "orange or kiwi", confidence: "tested", aliases: ["nashi", "asian pear"] },
  { name: "Watermelon", status: "red", dominantFodmap: "Fructose, fructans & mannitol", category: "Fruit", swap: "honeydew, cantaloupe or papaya", confidence: "tested", aliases: ["tarbooz", "tarbuj", "kalingad", "तरबूज"] },
  { name: "Honey", status: "red", dominantFodmap: "Excess fructose", category: "Sweetener", swap: "maple syrup or table sugar", confidence: "tested", aliases: ["shahad", "शहद", "madhu"] },
  { name: "High-fructose corn syrup", status: "red", dominantFodmap: "Excess fructose", category: "Sweetener", swap: "table sugar or maple syrup", confidence: "tested", aliases: ["hfcs", "corn syrup", "glucose-fructose syrup"] },
  { name: "Fruit juice", status: "red", dominantFodmap: "Excess fructose", category: "Fruit", swap: "a small piece of whole low-FODMAP fruit", prepNote: "Juicing strips fibre and concentrates fructose.", confidence: "estimated", aliases: ["juice", "fruit juice", "ras"] },
  { name: "Dried fruit", status: "red", dominantFodmap: "Excess fructose (concentrated)", category: "Fruit", swap: "a small serve of fresh low-FODMAP fruit", prepNote: "Drying concentrates the sugars; dates (khajoor) and figs (anjeer) are especially high.", confidence: "tested", aliases: ["raisins", "kishmish", "किशमिश", "dates", "khajoor", "anjeer", "sukha mewa", "dry fruit"] },

  // ───────────────────────── Lactose ─────────────────────────
  { name: "Milk (cow / buffalo / goat)", status: "red", dominantFodmap: "Lactose", category: "Dairy", swap: "lactose-free, soy-protein, oat or rice milk", confidence: "tested", aliases: ["doodh", "दूध", "cow milk", "buffalo milk", "gaay ka doodh", "bhains ka doodh", "full cream milk", "dudh"] },
  { name: "Custard", status: "red", dominantFodmap: "Lactose", category: "Dairy", swap: "custard made with lactose-free milk", confidence: "estimated", aliases: ["custard"] },
  { name: "Ice cream", status: "red", dominantFodmap: "Lactose", category: "Dairy", swap: "sorbet or lactose-free ice cream", confidence: "tested", aliases: ["icecream", "ice-cream", "kulfi"] },
  { name: "Yogurt", status: "red", dominantFodmap: "Lactose", category: "Dairy", swap: "lactose-free yogurt", confidence: "tested", aliases: ["curd", "dahi", "दही", "yoghurt"] },
  { name: "Soft cheese", status: "amber", dominantFodmap: "Lactose", category: "Dairy", safeServe: "about 40g of fresh ricotta / cottage / cream cheese", limitServe: "larger serves", swap: "hard/aged cheese (cheddar, parmesan) — near-zero lactose", confidence: "tested", aliases: ["cottage cheese", "cream cheese", "ricotta", "mascarpone", "chenna", "soft cheese"], note: "Fresh soft cheeses are low in a small serve; mascarpone and high-moisture cheeses stay high." },

  // ───────────────────────── Fructans ─────────────────────────
  { name: "Asparagus", status: "red", dominantFodmap: "Fructans & fructose", category: "Vegetable", swap: "green beans or carrot", confidence: "tested", aliases: ["shatavari (vegetable)"] },
  { name: "Beetroot", status: "amber", dominantFodmap: "Fructans & GOS", category: "Vegetable", safeServe: "a couple of slices, canned", limitServe: "a normal fresh serve", swap: "carrot or red capsicum for colour", confidence: "tested", aliases: ["chukandar", "चुकंदर", "beet"] },
  { name: "Broccoli", status: "amber", dominantFodmap: "Fructans", category: "Vegetable", safeServe: "about ¾ cup, mostly florets", limitServe: "large serves, or lots of stalk", prepNote: "Florets have a larger low-FODMAP serve than the stalk.", confidence: "tested", aliases: ["hari gobhi", "broccoli"], note: "The SA chart marked this high; Monash rates a small floret serve as low." },
  { name: "Brussels sprouts", status: "amber", dominantFodmap: "Fructans", category: "Vegetable", safeServe: "about 2 sprouts", limitServe: "4 or more", confidence: "tested", aliases: ["brussel sprouts"] },
  { name: "Cabbage", status: "amber", dominantFodmap: "Fructans", category: "Vegetable", safeServe: "common cabbage ~¾ cup; savoy ~½ cup", limitServe: "large serves", confidence: "tested", aliases: ["patta gobhi", "band gobhi", "पत्ता गोभी", "savoy cabbage"] },
  { name: "Eggplant", status: "green", category: "Vegetable", safeServe: "about 1 cup", confidence: "tested", aliases: ["brinjal", "baingan", "बैंगन", "vangi", "aubergine"], note: "The SA chart lists eggplant as high, but Monash tests brinjal/baingan as low — shown here as low." },
  { name: "Fennel", status: "amber", dominantFodmap: "Fructans & mannitol", category: "Vegetable", safeServe: "about ½ cup of bulb", limitServe: "a large serve", prepNote: "The bulb. Fennel seeds in small amounts are fine.", confidence: "tested", aliases: ["fennel bulb", "saunf (bulb)"] },
  { name: "Garlic", status: "red", dominantFodmap: "Fructans", category: "Vegetable", swap: "garlic-infused OIL (discard the solids) + a pinch of hing", prepNote: "Fructans are water-soluble, not oil-soluble — only strained oil is low; garlic powder/salt are high. Home-made garlic oil: use fresh garlic, refrigerate and use within days (botulism risk), or buy commercial.", confidence: "tested", aliases: ["lehsun", "lahsun", "लहसुन"] },
  { name: "Leek", status: "red", dominantFodmap: "Fructans", category: "Vegetable", swap: "green leek tops or chives", prepNote: "The white bulb is high; green leek tops are low.", confidence: "tested", aliases: ["leek"] },
  { name: "Okra", status: "amber", dominantFodmap: "Fructans", category: "Vegetable", safeServe: "a small serve (~½ cup)", limitServe: "a large serve", confidence: "estimated", aliases: ["bhindi", "भिंडी", "ladies finger", "lady finger", "bhendi"], note: "Chart lists it high; small serves are often tolerated — test your own." },
  { name: "Onion", status: "red", dominantFodmap: "Fructans", category: "Vegetable", swap: "hing (asafoetida) bloomed in oil + green spring-onion tops", prepNote: "Fructans are water-soluble — onion in any watery curry stays high even if you fish the pieces out. Use rice-flour/pure hing; wheat-cut hing adds gluten.", confidence: "tested", aliases: ["pyaaz", "pyaz", "प्याज़", "kanda"], note: "All onions. Green scallion tops are low." },
  { name: "Shallots", status: "red", dominantFodmap: "Fructans", category: "Vegetable", swap: "green spring-onion tops or hing", confidence: "tested", aliases: ["chhoti pyaaz", "shallot"] },
  { name: "Wheat", status: "red", dominantFodmap: "Fructans", category: "Grain", swap: "jowar (sorghum), bajra/millet or rice flour for roti/bhakri; rice. NOT besan.", prepNote: "It's the fructans, not gluten — a gluten-free diet isn't required. Applies to atta/maida/roti/naan, not just bread. Long-ferment sourdough spelt is lower.", confidence: "tested", aliases: ["atta", "maida", "gehu", "gehun", "गेहूं", "wheat flour", "roti", "chapati", "phulka", "paratha", "naan", "suji", "rava", "semolina", "dalia", "bread", "pasta", "couscous"] },
  { name: "Rye", status: "red", dominantFodmap: "Fructans", category: "Grain", swap: "sourdough spelt or rice", confidence: "tested", aliases: ["rye bread"] },
  { name: "Custard apple", status: "red", dominantFodmap: "Fructans", category: "Fruit", confidence: "estimated", aliases: ["sitaphal", "seetaphal", "sharifa", "शरीफा"] },
  { name: "Persimmon", status: "amber", dominantFodmap: "Fructans & sorbitol", category: "Fruit", safeServe: "about ¼ of a small one", limitServe: "half or more", confidence: "estimated", aliases: ["tendu", "amalok"] },
  { name: "Chicory", status: "red", dominantFodmap: "Fructans", category: "Vegetable", confidence: "tested", aliases: ["kasni", "chicory root"] },
  { name: "Dandelion", status: "red", dominantFodmap: "Fructans", category: "Vegetable", confidence: "estimated", aliases: ["dandelion greens"] },
  { name: "Inulin", status: "red", dominantFodmap: "Fructans (added fibre)", category: "Fibre", swap: "avoid added inulin / chicory-root fibre in packaged foods", confidence: "tested", aliases: ["chicory root fibre", "added fibre"], note: "A common prebiotic 'added fibre' in protein bars, yogurts and supplements." },

  // ───────────────────────── Galactans (GOS) ─────────────────────────
  { name: "Beans (legumes)", status: "red", dominantFodmap: "GOS", category: "Legume", swap: "a small canned & rinsed serve; firm tofu for protein", prepNote: "Canning + rinsing leaches GOS into the discarded liquid; dried-then-boiled stays high.", confidence: "tested", aliases: ["sem", "phali", "broad beans", "lima beans", "borlotti", "navy beans"] },
  { name: "Baked beans", status: "red", dominantFodmap: "GOS & fructose", category: "Legume", confidence: "estimated", aliases: ["baked beans"] },
  { name: "Chickpeas", status: "amber", dominantFodmap: "GOS", category: "Legume", safeServe: "~¼ cup, canned & rinsed", limitServe: "½ cup, or dried-then-boiled", swap: "small canned+rinsed serve; for flour use jowar/rice, NOT besan", prepNote: "Canned & rinsed has a real small low serve; besan (gram flour) stays high and is not a wheat-flour swap.", confidence: "tested", aliases: ["chana", "chhole", "chole", "छोले", "kabuli chana", "chana dal", "besan", "gram flour", "bengal gram"] },
  { name: "Kidney beans", status: "amber", dominantFodmap: "GOS", category: "Legume", safeServe: "about ⅓ cup (~85g) canned, drained & rinsed", limitServe: "more than ~⅓ cup", swap: "canned+rinsed serve; firm tofu", prepNote: "Canned & rinsed rajma is low up to about ⅓ cup; dried-then-boiled stays high.", confidence: "tested", aliases: ["rajma", "राजमा", "red kidney beans"] },
  { name: "Lentils", status: "amber", dominantFodmap: "GOS", category: "Legume", safeServe: "~¼ cup, canned & rinsed", limitServe: "½ cup, or a normal bowl of dal", swap: "small canned+rinsed serve", prepNote: "Canned & rinsed lentils have a small low serve; home-cooked dal in a full bowl is high.", confidence: "tested", aliases: ["dal", "daal", "दाल", "masoor", "masoor dal", "toor", "toor dal", "arhar", "moong", "moong dal", "urad", "urad dal", "chana dal", "split peas"] },
  { name: "Black-eyed peas", status: "amber", dominantFodmap: "GOS", category: "Legume", safeServe: "a small canned & rinsed serve", limitServe: "a normal serve", confidence: "estimated", aliases: ["lobia", "chawli", "cowpea"] },
  { name: "Pigeon peas", status: "red", dominantFodmap: "GOS", category: "Legume", swap: "small canned+rinsed lentils", prepNote: "Toor/arhar dal in a normal bowl is high; only tiny canned+rinsed serves are low.", confidence: "estimated", aliases: ["toor", "arhar", "tuvar"] },
  { name: "Soybeans", status: "red", dominantFodmap: "GOS & fructans", category: "Legume", swap: "firm/extra-firm tofu, or soy-protein milk", prepNote: "Whole soybeans & edamame are high; firm PRESSED tofu is low; silken tofu is higher.", confidence: "tested", aliases: ["soya beans", "soybean", "edamame"] },

  // ───────────────────────── Polyols ─────────────────────────
  { name: "Apricot", status: "red", dominantFodmap: "Sorbitol", category: "Fruit", confidence: "tested", aliases: ["khubani", "khumani"] },
  { name: "Avocado", status: "amber", dominantFodmap: "Sorbitol", category: "Fruit", safeServe: "about 3 tbsp (~¼ medium)", limitServe: "larger serves", confidence: "tested", aliases: ["makhanphal", "butter fruit"] },
  { name: "Blackberry", status: "red", dominantFodmap: "Sorbitol", category: "Fruit", swap: "blueberries, raspberries or strawberries", confidence: "tested", aliases: ["blackberry"] },
  { name: "Cherry", status: "red", dominantFodmap: "Fructose & sorbitol", category: "Fruit", confidence: "tested", aliases: ["cherry"] },
  { name: "Lychee", status: "amber", dominantFodmap: "Sorbitol & fructose", category: "Fruit", safeServe: "about 5 lychees", limitServe: "more than ~5", confidence: "estimated", aliases: ["litchi", "leechi"] },
  { name: "Nectarine", status: "red", dominantFodmap: "Sorbitol & fructose", category: "Fruit", confidence: "tested", aliases: ["nectarine"] },
  { name: "Peach", status: "red", dominantFodmap: "Sorbitol & fructans", category: "Fruit", confidence: "tested", aliases: ["aadu", "aaru", "aru"] },
  { name: "Plum", status: "red", dominantFodmap: "Sorbitol", category: "Fruit", confidence: "tested", aliases: ["aloo bukhara", "alu bukhara"] },
  { name: "Prune", status: "red", dominantFodmap: "Sorbitol", category: "Fruit", confidence: "tested", aliases: ["dried plum", "sukha aloo bukhara"] },
  { name: "Green bell pepper", status: "green", category: "Vegetable", confidence: "tested", aliases: ["green capsicum", "hari shimla mirch", "हरी शिमला मिर्च", "green pepper"], note: "Now low at a normal serve per Monash's retest; very large serves add fructans. Red capsicum is also low." },
  { name: "Mushroom", status: "red", dominantFodmap: "Mannitol", category: "Vegetable", swap: "canned/tinned or oyster mushrooms (low)", prepNote: "Button/common mushrooms are high; canned and oyster mushrooms are low.", confidence: "tested", aliases: ["khumb", "kumbh", "mushroom", "button mushroom"] },
  { name: "Sweet corn", status: "amber", dominantFodmap: "Sorbitol", category: "Vegetable", safeServe: "about ½ a cob", limitServe: "a whole cob or more", confidence: "tested", aliases: ["makka", "makai", "makki", "bhutta", "corn", "corn on the cob", "मक्का"] },
  { name: "Sugar alcohols", status: "red", dominantFodmap: "Polyols", category: "Sweetener", swap: "table sugar, maple syrup or glucose", confidence: "tested", aliases: ["sorbitol", "mannitol", "isomalt", "maltitol", "xylitol", "sugar free", "sugar-free gum", "sugar alcohol"], note: "Sweeteners ending in '-ol' — common in sugar-free gum, mints and 'diabetic' sweets." },

  // ───────────────────────── Fruit (low) ─────────────────────────
  { name: "Banana", status: "amber", dominantFodmap: "Fructans (when ripe)", category: "Fruit", safeServe: "1 firm/unripe, OR ~⅓ of a ripe one", limitServe: "a whole ripe (spotted) banana", prepNote: "Ripeness flips it: firm is low; very ripe is high in fructans.", confidence: "tested", aliases: ["kela", "केला"], note: "The old chart said 'low' — true only for firm or small serves." },
  { name: "Blueberry", status: "green", category: "Fruit", safeServe: "about ¼ cup", confidence: "tested", aliases: ["blueberry"] },
  { name: "Boysenberry", status: "green", category: "Fruit", confidence: "estimated", aliases: ["boysenberry"] },
  { name: "Cantaloupe", status: "green", category: "Fruit", safeServe: "about ¾ cup", confidence: "tested", aliases: ["rockmelon", "muskmelon", "kharbooja", "खरबूजा"] },
  { name: "Cranberry", status: "green", category: "Fruit", safeServe: "a small serve", confidence: "estimated", aliases: ["cranberry", "karaunda"] },
  { name: "Durian", status: "green", category: "Fruit", safeServe: "a small serve", confidence: "estimated", aliases: ["durian"] },
  { name: "Grape", status: "amber", dominantFodmap: "Excess fructose", category: "Fruit", safeServe: "a small serve only", limitServe: "a normal handful", confidence: "estimated", aliases: ["angoor", "अंगूर", "grapes"], note: "Monash's 2024 retest sharply lowered the grape serving; labs differ, so keep the portion small." },
  { name: "Grapefruit", status: "green", category: "Fruit", safeServe: "about ½ medium", confidence: "tested", aliases: ["chakotra"] },
  { name: "Honeydew melon", status: "green", category: "Fruit", safeServe: "about ½ cup", confidence: "tested", aliases: ["honeydew", "kharbooja (honeydew)"] },
  { name: "Kiwi", status: "green", category: "Fruit", confidence: "tested", aliases: ["kiwi", "kiwifruit"] },
  { name: "Lemon", status: "green", category: "Fruit", confidence: "tested", aliases: ["nimbu", "नींबू", "lemon", "bada nimbu"] },
  { name: "Lime", status: "green", category: "Fruit", confidence: "tested", aliases: ["nimbu", "kagzi nimbu", "lime"] },
  { name: "Mandarin", status: "green", category: "Fruit", confidence: "tested", aliases: ["kinnow", "santra (mandarin)"] },
  { name: "Orange", status: "green", category: "Fruit", confidence: "tested", aliases: ["santra", "narangi", "संतरा"] },
  { name: "Passionfruit", status: "green", category: "Fruit", confidence: "tested", aliases: ["krishna phal", "passion fruit"] },
  { name: "Papaya", status: "green", category: "Fruit", confidence: "tested", aliases: ["papita", "पपीता", "pawpaw"] },
  { name: "Raspberry", status: "green", category: "Fruit", safeServe: "about 30 berries", confidence: "tested", aliases: ["raspberry"] },
  { name: "Rhubarb", status: "green", category: "Fruit", confidence: "tested", aliases: ["rhubarb"] },
  { name: "Strawberry", status: "green", category: "Fruit", confidence: "tested", aliases: ["strawberry"] },
  { name: "Tangelo", status: "green", category: "Fruit", confidence: "estimated", aliases: ["tangelo"] },
  { name: "Star anise", status: "green", category: "Spice", confidence: "tested", aliases: ["chakri phool", "badiyan", "star anise", "phool chakri"] },

  // ───────────────────────── Vegetables (low) ─────────────────────────
  { name: "Alfalfa", status: "green", category: "Vegetable", confidence: "tested", aliases: ["alfalfa sprouts"] },
  { name: "Artichoke", status: "amber", dominantFodmap: "Fructans", category: "Vegetable", safeServe: "a small serve of canned hearts", limitServe: "a normal serve", confidence: "guidance", aliases: ["globe artichoke heart"], note: "Globe artichoke is generally high in fructans; only small canned-heart serves are lower. Jerusalem artichoke is high." },
  { name: "Bamboo shoots", status: "green", category: "Vegetable", confidence: "tested", aliases: ["bamboo", "bans"] },
  { name: "Bean shoots", status: "green", category: "Vegetable", confidence: "tested", aliases: ["bean sprouts", "sprouts", "ankurit", "moong sprouts"] },
  { name: "Bok choy", status: "green", category: "Vegetable", confidence: "tested", aliases: ["pak choi", "bok choi"] },
  { name: "Carrot", status: "green", category: "Vegetable", confidence: "tested", aliases: ["gajar", "गाजर"], note: "FODMAP-free — eat freely." },
  { name: "Celery", status: "amber", dominantFodmap: "Mannitol", category: "Vegetable", safeServe: "about ¼ of a medium stalk", limitServe: "½ stalk or more", confidence: "tested", aliases: ["ajmoda (stalk)", "celery"] },
  { name: "Choko", status: "green", category: "Vegetable", safeServe: "a small serve", confidence: "estimated", aliases: ["chow chow", "chayote", "ishkus", "chowchow"] },
  { name: "Choy sum", status: "green", category: "Vegetable", confidence: "tested", aliases: ["choy sum"] },
  { name: "Endive", status: "green", category: "Vegetable", confidence: "estimated", aliases: ["endive"] },
  { name: "Ginger", status: "green", category: "Spice", confidence: "tested", aliases: ["adrak", "अदरक", "ginger root"], note: "Low FODMAP (Monash lists a 5g serve, no upper limit) — safe at culinary amounts, great in place of onion/garlic." },
  { name: "Green beans", status: "green", category: "Vegetable", safeServe: "about 15 beans", confidence: "tested", aliases: ["french beans", "farasbi", "hari phali", "hari sem"] },
  { name: "Lettuce", status: "green", category: "Vegetable", confidence: "tested", aliases: ["salad patta", "lettuces", "iceberg lettuce"] },
  { name: "Olives", status: "green", category: "Vegetable", confidence: "tested", aliases: ["jaitun", "olive"] },
  { name: "Parsnip", status: "green", category: "Vegetable", confidence: "tested", aliases: ["parsnip"] },
  { name: "Potato", status: "green", category: "Vegetable", confidence: "tested", aliases: ["aloo", "alu", "batata", "आलू"], note: "FODMAP-free staple — a good base for any meal." },
  { name: "Pumpkin", status: "green", category: "Vegetable", safeServe: "Kent/Japanese pumpkin, ~1 cup", limitServe: "butternut beyond ~¼ cup", prepNote: "Kent/Japanese pumpkin is low; butternut is limited (mannitol).", confidence: "tested", aliases: ["kaddu", "kadoo", "bhopla", "कद्दू", "japanese pumpkin", "kent pumpkin"] },
  { name: "Red bell pepper", status: "green", category: "Vegetable", confidence: "tested", aliases: ["red capsicum", "lal shimla mirch", "लाल शिमला मिर्च", "red pepper"] },
  { name: "Silver beet", status: "green", category: "Vegetable", confidence: "tested", aliases: ["chard", "swiss chard"] },
  { name: "Spinach", status: "green", category: "Vegetable", safeServe: "baby spinach freely; ~1 cup mature", confidence: "tested", aliases: ["palak", "पालक", "baby spinach"] },
  { name: "Summer squash", status: "green", category: "Vegetable", safeServe: "a small serve", confidence: "estimated", aliases: ["yellow squash", "pattypan"] },
  { name: "Swede", status: "green", category: "Vegetable", confidence: "tested", aliases: ["rutabaga"] },
  { name: "Sweet potato", status: "amber", dominantFodmap: "Mannitol", category: "Vegetable", safeServe: "about ½ cup", limitServe: "¾ cup or more", swap: "regular potato (no limit) or Kent pumpkin", confidence: "tested", aliases: ["shakarkandi", "शकरकंद", "shakarkand"] },
  { name: "Taro", status: "green", category: "Vegetable", safeServe: "about ½ cup", confidence: "estimated", aliases: ["arbi", "arvi", "ghuiya", "अरबी"] },
  { name: "Tomato", status: "green", category: "Vegetable", confidence: "tested", aliases: ["tamatar", "टमाटर"], note: "Common tomato is low; sun-dried tomato is limited." },
  { name: "Turnip", status: "green", category: "Vegetable", confidence: "tested", aliases: ["shalgam", "शलगम"] },
  { name: "Yam", status: "green", category: "Vegetable", safeServe: "about ½ cup", confidence: "estimated", aliases: ["ratalu", "jimikand", "suran", "elephant foot yam"], note: "True yam (ratalu/suran) is low — not the same as sweet potato." },
  { name: "Zucchini", status: "green", category: "Vegetable", safeServe: "about ⅓ cup", limitServe: "a large serve (fructans)", confidence: "tested", aliases: ["courgette", "zucchini"] },

  // ───────────────────────── Starch / grains (low) ─────────────────────────
  { name: "Rice", status: "green", category: "Grain", confidence: "tested", aliases: ["chawal", "chaval", "bhaat", "बासमती", "basmati", "brown rice", "poha", "puffed rice", "murmura", "idli", "dosa (rice)"], note: "Plain rice and rice foods (poha, idli, plain dosa) are reliable low-FODMAP staples." },
  { name: "Oats", status: "green", category: "Grain", safeServe: "about ½ cup dry, rolled", limitServe: "large serves (GOS/fructans)", confidence: "tested", aliases: ["oats", "oatmeal", "rolled oats"] },
  { name: "Polenta", status: "green", category: "Grain", confidence: "tested", aliases: ["cornmeal", "maize meal"] },
  { name: "Millet", status: "green", category: "Grain", confidence: "tested", aliases: ["bajra", "bajri", "बाजरा", "ragi", "nachni", "finger millet", "foxtail millet", "kodo millet", "millets"], note: "Millets like bajra & ragi are low — great for rotis and bhakri." },
  { name: "Sorghum", status: "green", category: "Grain", confidence: "tested", aliases: ["jowar", "jwari", "ज्वारी", "jondhala", "bhakri", "jowar roti"], note: "Jowar (sorghum) is low — jowar/bajra bhakri is a solid low-FODMAP roti." },
  { name: "Quinoa", status: "green", category: "Grain", confidence: "tested", aliases: ["quinoa", "kinwa"] },
  { name: "Tapioca", status: "green", category: "Grain", confidence: "tested", aliases: ["sabudana", "साबूदाना", "sago", "sabakki", "javvarisi", "tapioca pearls"], note: "Sabudana/sago — sabudana khichdi is low-FODMAP friendly." },
  { name: "Arrowroot", status: "green", category: "Grain", confidence: "estimated", aliases: ["ararot", "arrowroot flour", "ararot powder"] },
  { name: "Psyllium", status: "green", category: "Fibre", confidence: "tested", aliases: ["isabgol", "isabghol", "sat isabgol", "psyllium husk"], note: "A low-FODMAP fibre often recommended for IBS." },
  { name: "Spelt bread", status: "green", category: "Grain", safeServe: "about 2 slices, sourdough", prepNote: "100% spelt, ideally long-ferment sourdough.", confidence: "tested", aliases: ["spelt", "100% spelt bread", "spelt sourdough"] },
  { name: "Gluten-free bread", status: "green", category: "Grain", confidence: "tested", aliases: ["gluten free bread", "gf bread", "gluten free cereal"] },

  // ───────────────────────── Dairy & alternatives (low) ─────────────────────────
  { name: "Lactose-free milk", status: "green", category: "Dairy", confidence: "tested", aliases: ["lactose free milk", "lactaid"] },
  { name: "Oat milk", status: "amber", dominantFodmap: "Fructans & GOS", category: "Dairy alt", safeServe: "about ½ cup (~100 ml)", limitServe: "a full cup (~250 ml)", prepNote: "Low only in a small serve; a full cup is high. Check it has no added inulin/chicory.", confidence: "tested", aliases: ["oat milk"] },
  { name: "Rice milk", status: "green", category: "Dairy alt", safeServe: "about 200 ml (~¾ cup)", limitServe: "larger serves rise in fructose/fructans", confidence: "tested", aliases: ["rice milk"] },
  { name: "Soy milk (soy protein)", status: "green", category: "Dairy alt", prepNote: "Must be made from soy PROTEIN, not whole soybeans; check additives.", confidence: "tested", aliases: ["soya milk", "soy milk"] },
  { name: "Hard cheese", status: "green", category: "Dairy", confidence: "tested", aliases: ["cheddar", "parmesan", "brie", "camembert", "hard cheese", "amul cheese"], note: "Hard/ripened cheeses are naturally near-zero lactose." },
  { name: "Lactose-free yogurt", status: "green", category: "Dairy", confidence: "tested", aliases: ["lactose free curd", "lactose free yogurt"] },
  { name: "Sorbet", status: "green", category: "Dairy alt", prepNote: "Dairy-free (fruit + sugar). Check the fruit base is low-FODMAP.", confidence: "estimated", aliases: ["sorbet"] },
  { name: "Gelato", status: "red", dominantFodmap: "Lactose", category: "Dairy", swap: "sorbet (dairy-free) or lactose-free ice cream", confidence: "tested", aliases: ["gelati", "italian ice cream"], note: "Dairy gelato carries ice-cream-level lactose — high at a normal serve." },
  { name: "Paneer", status: "amber", dominantFodmap: "Lactose", category: "Dairy", safeServe: "a small portion (~40g)", limitServe: "larger serves, if lactose-sensitive", swap: "firm/extra-firm tofu in curries; or paneer made from lactose-free milk", prepNote: "Fresh cheese; lower in lactose than milk because the whey is drained — but not fully Monash-verified, so test a small serve.", confidence: "guidance", aliases: ["chhena", "indian cottage cheese", "cottage cheese (indian)"], note: "In palak paneer etc. the usual trigger is the onion/garlic/cream base, not the paneer." },
  { name: "Buttermilk (chaas)", status: "amber", dominantFodmap: "Lactose", category: "Dairy", safeServe: "a small glass of thin, salted chaas", limitServe: "a large or sweet glass", prepNote: "Thin, diluted chaas is lower-lactose; sweet/large lassi is higher.", confidence: "guidance", aliases: ["chaas", "chhaas", "matha", "mattha", "lassi (thin)"] },
  { name: "Olive oil", status: "green", category: "Fat", confidence: "tested", aliases: ["jaitun ka tel", "butter substitute", "oil"], note: "All plain oils are FODMAP-free — a good butter/ghee substitute." },

  // ───────────────────────── Sweeteners (low) ─────────────────────────
  { name: "Table sugar (sucrose)", status: "green", category: "Sweetener", safeServe: "normal amounts", confidence: "tested", aliases: ["sugar", "cheeni", "chini", "shakkar", "चीनी", "sucrose"] },
  { name: "Glucose", status: "green", category: "Sweetener", confidence: "tested", aliases: ["dextrose", "glucose"] },
  { name: "Maple syrup", status: "green", category: "Sweetener", confidence: "tested", aliases: ["maple syrup"] },
  { name: "Golden syrup", status: "amber", dominantFodmap: "Fructans", category: "Sweetener", safeServe: "about 1 tsp", limitServe: "1 tbsp or more", confidence: "tested", aliases: ["golden syrup"] },
  { name: "Molasses", status: "amber", dominantFodmap: "Excess fructose", category: "Sweetener", safeServe: "about 1 tsp", limitServe: "1 tbsp or more", confidence: "tested", aliases: ["molasses", "treacle"] },
  { name: "Jaggery (gur)", status: "amber", category: "Sweetener", safeServe: "treat like sugar — small amounts", swap: "table sugar or maple syrup (both lab-tested low)", confidence: "guidance", aliases: ["gur", "gud", "गुड़", "jaggery"], note: "Sugarcane jaggery isn't lab-tested for FODMAPs; small amounts are likely fine but treat as guidance." },
];
