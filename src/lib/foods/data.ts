// Low-FODMAP food reference, transcribed from the Gastroenterology Consultants
// of San Antonio "Low FODMAP Diet" chart (gastroconsa.com). The chart's
// low/high classification is kept faithfully; we ADD alternate names — English
// synonyms + Indian/regional names (romanized + some Devanagari) — so Indian
// users can find a food by whatever they call it. Notes flag portion caveats and
// the few well-known chart discrepancies. This is a reference, NOT medical
// advice — FODMAP tolerance is portion-dependent and personal.

export type Fodmap = "low" | "high"; // low = enjoy/safe, high = avoid

export interface FoodItem {
  name: string; // canonical English name
  fodmap: Fodmap;
  group: string; // why: the FODMAP group (high) or food category (low)
  aliases: string[]; // synonyms + Indian/regional names
  note?: string;
}

export const FOOD_SOURCE = "Gastroenterology Consultants of San Antonio — gastroconsa.com";

export const FOODS: FoodItem[] = [
  // ───────────────────────── AVOID — Excess fructose ─────────────────────────
  { name: "Apple", fodmap: "high", group: "Excess fructose / Polyols", aliases: ["seb", "सेब"] },
  { name: "Mango", fodmap: "high", group: "Excess fructose", aliases: ["aam", "आम"] },
  { name: "Pear", fodmap: "high", group: "Excess fructose / Polyols", aliases: ["nashpati", "nashpati", "नाशपाती", "babbugosha"] },
  { name: "Nashi pear", fodmap: "high", group: "Excess fructose / Polyols", aliases: ["nashi", "asian pear"] },
  { name: "Watermelon", fodmap: "high", group: "Excess fructose / Fructans / Polyols", aliases: ["tarbooz", "tarbuj", "kalingad", "तरबूज"] },
  { name: "Honey", fodmap: "high", group: "Excess fructose (sweetener)", aliases: ["shahad", "शहद", "madhu"], note: "Use maple syrup or golden syrup as a low-FODMAP swap." },
  { name: "High-fructose corn syrup", fodmap: "high", group: "Excess fructose (sweetener)", aliases: ["hfcs", "corn syrup", "glucose-fructose syrup"] },
  { name: "Fruit juice", fodmap: "high", group: "Excess fructose", aliases: ["juice", "fruit juice", "ras"], note: "Concentrates fructose; a small piece of whole low-FODMAP fruit is better." },
  { name: "Dried fruit", fodmap: "high", group: "Excess fructose (concentrated)", aliases: ["raisins", "kishmish", "किशमिश", "dates", "khajoor", "anjeer", "sukha mewa", "dry fruit"], note: "Dried fruit (raisins, dates, figs) concentrates fructose." },

  // ───────────────────────── AVOID — Lactose ─────────────────────────
  { name: "Milk (cow / buffalo / goat)", fodmap: "high", group: "Lactose", aliases: ["doodh", "दूध", "cow milk", "buffalo milk", "gaay ka doodh", "bhains ka doodh", "full cream milk", "dudh"], note: "Regular dairy milk. Swap for lactose-free, soy (protein), oat or rice milk." },
  { name: "Custard", fodmap: "high", group: "Lactose", aliases: ["custard"] },
  { name: "Ice cream", fodmap: "high", group: "Lactose", aliases: ["icecream", "ice-cream", "kulfi"], note: "Try gelati or sorbet instead." },
  { name: "Yogurt", fodmap: "high", group: "Lactose", aliases: ["curd", "dahi", "दही", "yoghurt"], note: "Regular curd. Lactose-free yogurt is fine." },
  { name: "Soft cheese", fodmap: "high", group: "Lactose", aliases: ["cottage cheese", "cream cheese", "ricotta", "mascarpone", "chenna", "soft cheese"], note: "Soft, unripened cheeses. Hard cheeses (cheddar, parmesan) are low." },

  // ───────────────────────── AVOID — Fructans ─────────────────────────
  { name: "Asparagus", fodmap: "high", group: "Fructans", aliases: ["shatavari (vegetable)"] },
  { name: "Beetroot", fodmap: "high", group: "Fructans", aliases: ["chukandar", "चुकंदर", "beet"] },
  { name: "Broccoli", fodmap: "high", group: "Fructans", aliases: ["hari gobhi", "broccoli"], note: "Heads/florets are higher; small amounts of the stalk are better tolerated." },
  { name: "Brussels sprouts", fodmap: "high", group: "Fructans", aliases: ["brussel sprouts"] },
  { name: "Cabbage", fodmap: "high", group: "Fructans", aliases: ["patta gobhi", "band gobhi", "पत्ता गोभी", "savoy cabbage"] },
  { name: "Eggplant", fodmap: "high", group: "Fructans", aliases: ["brinjal", "baingan", "बैंगन", "vangi", "aubergine"], note: "This chart lists eggplant as high; several other sources rate it low — test your own tolerance." },
  { name: "Fennel", fodmap: "high", group: "Fructans", aliases: ["fennel bulb", "saunf (bulb)"], note: "The bulb. Fennel seeds in small amounts are fine." },
  { name: "Garlic", fodmap: "high", group: "Fructans", aliases: ["lehsun", "lahsun", "लहसुन"], note: "High even in tiny amounts. Garlic-infused oil is low-FODMAP." },
  { name: "Leek", fodmap: "high", group: "Fructans", aliases: ["leek"], note: "The white bulb. Green leek tops are low." },
  { name: "Okra", fodmap: "high", group: "Fructans", aliases: ["bhindi", "भिंडी", "ladies finger", "lady finger", "bhendi"] },
  { name: "Onion", fodmap: "high", group: "Fructans", aliases: ["pyaaz", "pyaz", "प्याज़", "kanda", "kांदा"], note: "All onions, all colours. Green scallion tops are low." },
  { name: "Shallots", fodmap: "high", group: "Fructans", aliases: ["chhoti pyaaz", "shallot"] },
  { name: "Wheat", fodmap: "high", group: "Fructans", aliases: ["atta", "maida", "gehu", "gehun", "गेहूं", "wheat flour", "roti", "chapati", "phulka", "paratha", "naan", "suji", "rava", "semolina", "dalia", "bread", "pasta", "couscous"], note: "Wheat & rye in larger amounts (roti, bread, pasta). Sourdough spelt and gluten-free are lower." },
  { name: "Rye", fodmap: "high", group: "Fructans", aliases: ["rye bread"] },
  { name: "Custard apple", fodmap: "high", group: "Fructans", aliases: ["sitaphal", "seetaphal", "sharifa", "शरीफा"] },
  { name: "Persimmon", fodmap: "high", group: "Fructans", aliases: ["tendu", "amalok"] },
  { name: "Chicory", fodmap: "high", group: "Fructans", aliases: ["kasni", "chicory root"] },
  { name: "Dandelion", fodmap: "high", group: "Fructans", aliases: ["dandelion greens"] },
  { name: "Inulin", fodmap: "high", group: "Fructans (added fibre)", aliases: ["chicory root fibre", "added fibre"], note: "A common 'added fibre' / prebiotic in packaged foods." },

  // ───────────────────────── AVOID — Galactans (GOS) ─────────────────────────
  { name: "Beans (legumes)", fodmap: "high", group: "Galactans (GOS)", aliases: ["sem", "phali", "broad beans", "lima beans", "borlotti", "navy beans"] },
  { name: "Baked beans", fodmap: "high", group: "Galactans (GOS)", aliases: ["baked beans"] },
  { name: "Chickpeas", fodmap: "high", group: "Galactans (GOS)", aliases: ["chana", "chhole", "chole", "छोले", "kabuli chana", "chana dal", "besan", "gram flour", "bengal gram"], note: "Besan (gram flour) too. Small, well-rinsed canned servings are often tolerated." },
  { name: "Kidney beans", fodmap: "high", group: "Galactans (GOS)", aliases: ["rajma", "राजमा", "red kidney beans"] },
  { name: "Lentils", fodmap: "high", group: "Galactans (GOS)", aliases: ["dal", "daal", "दाल", "masoor", "masoor dal", "toor", "toor dal", "arhar", "moong", "moong dal", "urad", "urad dal", "chana dal", "split peas"], note: "Small, well-rinsed canned portions may be OK; large or dry-cooked servings are high." },
  { name: "Black-eyed peas", fodmap: "high", group: "Galactans (GOS)", aliases: ["lobia", "chawli", "cowpea"] },
  { name: "Pigeon peas", fodmap: "high", group: "Galactans (GOS)", aliases: ["toor", "arhar", "tuvar"] },
  { name: "Soybeans", fodmap: "high", group: "Galactans (GOS)", aliases: ["soya beans", "soybean", "edamame"], note: "Whole soybeans are high; firm tofu and soy-protein milk are low." },

  // ───────────────────────── AVOID — Polyols ─────────────────────────
  { name: "Apricot", fodmap: "high", group: "Polyols", aliases: ["khubani", "khumani"] },
  { name: "Avocado", fodmap: "high", group: "Polyols", aliases: ["makhanphal", "butter fruit"], note: "Small amounts (~1/8) may be tolerated." },
  { name: "Blackberry", fodmap: "high", group: "Polyols", aliases: ["blackberry"] },
  { name: "Cherry", fodmap: "high", group: "Polyols", aliases: ["cherry"] },
  { name: "Lychee", fodmap: "high", group: "Polyols", aliases: ["litchi", "leechi"] },
  { name: "Nectarine", fodmap: "high", group: "Polyols", aliases: ["nectarine"] },
  { name: "Peach", fodmap: "high", group: "Polyols", aliases: ["aadu", "aaru", "aru"] },
  { name: "Plum", fodmap: "high", group: "Polyols", aliases: ["aloo bukhara", "alu bukhara"] },
  { name: "Prune", fodmap: "high", group: "Polyols", aliases: ["dried plum", "sukha aloo bukhara"] },
  { name: "Green bell pepper", fodmap: "high", group: "Polyols", aliases: ["green capsicum", "hari shimla mirch", "हरी शिमला मिर्च", "green pepper"], note: "Green capsicum. Red capsicum is low." },
  { name: "Mushroom", fodmap: "high", group: "Polyols", aliases: ["khumb", "kumbh", "mushroom", "button mushroom"], note: "Canned/oyster mushrooms are lower than button mushrooms." },
  { name: "Sweet corn", fodmap: "high", group: "Polyols", aliases: ["makka", "makai", "makki", "bhutta", "corn", "corn on the cob", "मक्का"] },
  { name: "Sugar alcohols", fodmap: "high", group: "Polyols (sweeteners)", aliases: ["sorbitol", "mannitol", "isomalt", "maltitol", "xylitol", "sugar free", "sugar-free gum", "sugar alcohol"], note: "Sweeteners ending in '-ol' — common in sugar-free gum, mints and 'diabetic' sweets." },

  // ───────────────────────── ENJOY — Fruit ─────────────────────────
  { name: "Banana", fodmap: "low", group: "Fruit", aliases: ["kela", "केला"], note: "Firm/just-ripe banana in a normal serve; very ripe banana is higher." },
  { name: "Blueberry", fodmap: "low", group: "Fruit", aliases: ["blueberry"] },
  { name: "Boysenberry", fodmap: "low", group: "Fruit", aliases: ["boysenberry"] },
  { name: "Cantaloupe", fodmap: "low", group: "Fruit", aliases: ["rockmelon", "muskmelon", "kharbooja", "खरबूजा"] },
  { name: "Cranberry", fodmap: "low", group: "Fruit", aliases: ["cranberry", "karaunda"] },
  { name: "Durian", fodmap: "low", group: "Fruit", aliases: ["durian"] },
  { name: "Grape", fodmap: "low", group: "Fruit", aliases: ["angoor", "अंगूर", "grapes"] },
  { name: "Grapefruit", fodmap: "low", group: "Fruit", aliases: ["chakotra"] },
  { name: "Honeydew melon", fodmap: "low", group: "Fruit", aliases: ["honeydew", "kharbooja (honeydew)"] },
  { name: "Kiwi", fodmap: "low", group: "Fruit", aliases: ["kiwi", "kiwifruit"] },
  { name: "Lemon", fodmap: "low", group: "Fruit", aliases: ["nimbu", "नींबू", "lemon", "bada nimbu"] },
  { name: "Lime", fodmap: "low", group: "Fruit", aliases: ["nimbu", "kagzi nimbu", "lime"] },
  { name: "Mandarin", fodmap: "low", group: "Fruit", aliases: ["kinnow", "santra (mandarin)"] },
  { name: "Orange", fodmap: "low", group: "Fruit", aliases: ["santra", "narangi", "संतरा"] },
  { name: "Passionfruit", fodmap: "low", group: "Fruit", aliases: ["krishna phal", "passion fruit"] },
  { name: "Papaya", fodmap: "low", group: "Fruit", aliases: ["papita", "पपीता", "pawpaw"] },
  { name: "Raspberry", fodmap: "low", group: "Fruit", aliases: ["raspberry"] },
  { name: "Rhubarb", fodmap: "low", group: "Fruit", aliases: ["rhubarb"] },
  { name: "Strawberry", fodmap: "low", group: "Fruit", aliases: ["strawberry"] },
  { name: "Tangelo", fodmap: "low", group: "Fruit", aliases: ["tangelo"] },
  { name: "Star anise", fodmap: "low", group: "Spice", aliases: ["chakri phool", "badiyan", "star anise", "phool chakri"] },

  // ───────────────────────── ENJOY — Vegetables ─────────────────────────
  { name: "Alfalfa", fodmap: "low", group: "Vegetable", aliases: ["alfalfa sprouts"] },
  { name: "Artichoke", fodmap: "low", group: "Vegetable", aliases: ["globe artichoke heart"], note: "Canned artichoke hearts are low; Jerusalem artichoke is high." },
  { name: "Bamboo shoots", fodmap: "low", group: "Vegetable", aliases: ["bamboo", "bans"] },
  { name: "Bean shoots", fodmap: "low", group: "Vegetable", aliases: ["bean sprouts", "sprouts", "ankurit", "moong sprouts"] },
  { name: "Bok choy", fodmap: "low", group: "Vegetable", aliases: ["pak choi", "bok choi"] },
  { name: "Carrot", fodmap: "low", group: "Vegetable", aliases: ["gajar", "गाजर"] },
  { name: "Celery", fodmap: "low", group: "Vegetable", aliases: ["ajmoda (stalk)", "celery"], note: "Small serve (~1/4 stalk); larger amounts are high in polyols." },
  { name: "Choko", fodmap: "low", group: "Vegetable", aliases: ["chow chow", "chayote", "ishkus", "chowchow"] },
  { name: "Choy sum", fodmap: "low", group: "Vegetable", aliases: ["choy sum"] },
  { name: "Endive", fodmap: "low", group: "Vegetable", aliases: ["endive"] },
  { name: "Ginger", fodmap: "low", group: "Vegetable / Spice", aliases: ["adrak", "अदरक"] },
  { name: "Green beans", fodmap: "low", group: "Vegetable", aliases: ["french beans", "farasbi", "hari phali", "hari sem"] },
  { name: "Lettuce", fodmap: "low", group: "Vegetable", aliases: ["salad patta", "lettuces", "iceberg lettuce"] },
  { name: "Olives", fodmap: "low", group: "Vegetable", aliases: ["jaitun", "olive"] },
  { name: "Parsnip", fodmap: "low", group: "Vegetable", aliases: ["parsnip"] },
  { name: "Potato", fodmap: "low", group: "Vegetable", aliases: ["aloo", "alu", "batata", "आलू"] },
  { name: "Pumpkin", fodmap: "low", group: "Vegetable", aliases: ["kaddu", "kadoo", "bhopla", "कद्दू", "japanese pumpkin", "kent pumpkin"], note: "Kent/Japanese pumpkin is low; butternut is limited to ~1/4 cup." },
  { name: "Red bell pepper", fodmap: "low", group: "Vegetable", aliases: ["red capsicum", "lal shimla mirch", "लाल शिमला मिर्च", "red pepper"] },
  { name: "Silver beet", fodmap: "low", group: "Vegetable", aliases: ["chard", "swiss chard"] },
  { name: "Spinach", fodmap: "low", group: "Vegetable", aliases: ["palak", "पालक", "baby spinach"] },
  { name: "Summer squash", fodmap: "low", group: "Vegetable", aliases: ["yellow squash", "pattypan"] },
  { name: "Swede", fodmap: "low", group: "Vegetable", aliases: ["rutabaga"] },
  { name: "Sweet potato", fodmap: "low", group: "Vegetable", aliases: ["shakarkandi", "शकरकंद", "shakarkand"], note: "Low in a small serve (~1/2 cup)." },
  { name: "Taro", fodmap: "low", group: "Vegetable", aliases: ["arbi", "arvi", "ghuiya", "अरबी"] },
  { name: "Tomato", fodmap: "low", group: "Vegetable", aliases: ["tamatar", "टमाटर"], note: "Common tomato is low; sun-dried tomato is limited." },
  { name: "Turnip", fodmap: "low", group: "Vegetable", aliases: ["shalgam", "शलगम"] },
  { name: "Yam", fodmap: "low", group: "Vegetable", aliases: ["ratalu", "jimikand", "suran", "elephant foot yam"] },
  { name: "Zucchini", fodmap: "low", group: "Vegetable", aliases: ["courgette", "zucchini"] },
  { name: "Ginger root", fodmap: "low", group: "Spice", aliases: ["adrak"] },

  // ───────────────────────── ENJOY — Starch / grains ─────────────────────────
  { name: "Rice", fodmap: "low", group: "Starch / grain", aliases: ["chawal", "chaval", "bhaat", "बासमती", "basmati", "brown rice", "poha", "puffed rice", "murmura", "idli", "dosa (rice)"], note: "Plain rice and rice-based foods (poha, idli, plain dosa) are good staples." },
  { name: "Oats", fodmap: "low", group: "Starch / grain", aliases: ["oats", "oatmeal", "rolled oats", "jई"] },
  { name: "Polenta", fodmap: "low", group: "Starch / grain", aliases: ["cornmeal", "maize meal"] },
  { name: "Millet", fodmap: "low", group: "Starch / grain", aliases: ["bajra", "bajri", "बाजरा", "ragi", "nachni", "finger millet", "foxtail millet", "kodo millet", "millets"], note: "Millets like bajra & ragi are low — great for rotis and bhakri." },
  { name: "Sorghum", fodmap: "low", group: "Starch / grain", aliases: ["jowar", "jwari", "ज्वारी", "jondhala", "bhakri", "jowar roti"], note: "Jowar (sorghum) is low — jowar/bajra bhakri is a solid low-FODMAP roti." },
  { name: "Quinoa", fodmap: "low", group: "Starch / grain", aliases: ["quinoa", "kinwa"] },
  { name: "Tapioca", fodmap: "low", group: "Starch / grain", aliases: ["sabudana", "साबूदाना", "sago", "sabakki", "javvarisi", "tapioca pearls"], note: "Sabudana/sago — sabudana khichdi is low-FODMAP friendly." },
  { name: "Arrowroot", fodmap: "low", group: "Starch / grain", aliases: ["ararot", "arrowroot flour", "ararot powder"] },
  { name: "Psyllium", fodmap: "low", group: "Fibre", aliases: ["isabgol", "isabghol", "sat isabgol", "psyllium husk"] },
  { name: "Spelt bread", fodmap: "low", group: "Starch / grain", aliases: ["spelt", "100% spelt bread", "spelt sourdough"], note: "100% spelt (ideally sourdough)." },
  { name: "Gluten-free bread", fodmap: "low", group: "Starch / grain", aliases: ["gluten free bread", "gf bread", "gluten free cereal"] },

  // ───────────────────────── ENJOY — Dairy & alternatives ─────────────────────────
  { name: "Lactose-free milk", fodmap: "low", group: "Dairy", aliases: ["lactose free milk", "lactaid"] },
  { name: "Oat milk", fodmap: "low", group: "Dairy alternative", aliases: ["oat milk"], note: "Check for added inulin/chicory." },
  { name: "Rice milk", fodmap: "low", group: "Dairy alternative", aliases: ["rice milk"] },
  { name: "Soy milk (soy protein)", fodmap: "low", group: "Dairy alternative", aliases: ["soya milk", "soy milk"], note: "Choose soy made from soy PROTEIN, not whole soybeans; check additives." },
  { name: "Hard cheese", fodmap: "low", group: "Dairy", aliases: ["cheddar", "parmesan", "brie", "camembert", "hard cheese", "amul cheese"], note: "Hard/ripened cheeses are naturally very low in lactose." },
  { name: "Lactose-free yogurt", fodmap: "low", group: "Dairy", aliases: ["lactose free curd", "lactose free yogurt"] },
  { name: "Sorbet", fodmap: "low", group: "Dairy alternative", aliases: ["gelati", "gelato", "sorbet"], note: "An ice-cream alternative." },
  { name: "Paneer", fodmap: "low", group: "Dairy", aliases: ["chhena", "indian cottage cheese", "cottage cheese (indian)"], note: "Fresh Indian cheese — lower in lactose than milk; small portions are usually fine, but tolerance varies." },
  { name: "Buttermilk (chaas)", fodmap: "low", group: "Dairy", aliases: ["chaas", "chhaas", "matha", "mattha", "lassi (thin)"], note: "Thin, salted chaas in a small serve is usually OK; sweet/large lassi is higher." },
  { name: "Olive oil", fodmap: "low", group: "Fat", aliases: ["jaitun ka tel", "butter substitute", "oil"], note: "A butter substitute; all plain oils are FODMAP-free." },

  // ───────────────────────── ENJOY — Sweeteners ─────────────────────────
  { name: "Table sugar (sucrose)", fodmap: "low", group: "Sweetener", aliases: ["sugar", "cheeni", "chini", "shakkar", "चीनी", "sucrose"], note: "Plain sugar in normal amounts is low." },
  { name: "Glucose", fodmap: "low", group: "Sweetener", aliases: ["dextrose", "glucose"] },
  { name: "Maple syrup", fodmap: "low", group: "Sweetener", aliases: ["maple syrup"] },
  { name: "Golden syrup", fodmap: "low", group: "Sweetener", aliases: ["golden syrup"] },
  { name: "Molasses", fodmap: "low", group: "Sweetener", aliases: ["molasses", "treacle"], note: "Small amounts." },
  { name: "Jaggery (gur)", fodmap: "low", group: "Sweetener", aliases: ["gur", "gud", "गुड़", "jaggery"], note: "Made from sugarcane; treat like sugar — small amounts. (Limited formal FODMAP data.)" },
];
