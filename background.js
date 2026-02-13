// background.js — ShopSwitch v1.0.0
// Service worker: searches bol.com with EN + NL queries, manages matches & state

const SS = "ShopSwitch"; // log prefix
const resultsByTab = {};

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════

function persist(tabId) {
  const d = resultsByTab[tabId];
  if (d) chrome.storage.session.set({ [`tab_${tabId}`]: d });
}

async function loadPersisted(tabId) {
  const key = `tab_${tabId}`;
  const s = await chrome.storage.session.get(key);
  if (s[key]) resultsByTab[tabId] = s[key];
  return resultsByTab[tabId] || null;
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

async function getSettings() {
  const defaults = { badgeStyle: "neutral" };
  const stored = await chrome.storage.sync.get("shopswitch_settings");
  return { ...defaults, ...(stored.shopswitch_settings || {}) };
}

// ═══════════════════════════════════════════════════════════════
// BADGE
// ═══════════════════════════════════════════════════════════════

function setBadge(tabId, text, color) {
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}
const badge = {
  loading:  (t) => setBadge(t, "…", "#2563EB"),
  found:    (t) => setBadge(t, "✓", "#0DAA4C"),
  cheaper:  (t) => setBadge(t, "✓", "#0DAA4C"),
  pricier:  (t) => setBadge(t, "✓", "#D94040"),
  noPrice:  (t) => setBadge(t, "✓", "#999"),
  approx:   (t) => setBadge(t, "≈", "#7C3AED"),
  notFound: (t) => setBadge(t, "✗", "#999"),
  error:    (t) => setBadge(t, "!", "#E74C3C"),
};

// ═══════════════════════════════════════════════════════════════
// EN → NL PRODUCT TERM DICTIONARY
// ═══════════════════════════════════════════════════════════════

const EN_NL_DICT = {
  // Common product terms
  "wireless": "draadloos", "charger": "oplader", "charging": "opladen",
  "battery": "batterij", "batteries": "batterijen", "cable": "kabel",
  "adapter": "adapter", "headphones": "koptelefoon", "earbuds": "oordopjes",
  "speaker": "luidspreker", "keyboard": "toetsenbord", "mouse": "muis",
  "monitor": "beeldscherm", "screen": "scherm", "laptop": "laptop",
  "tablet": "tablet", "phone": "telefoon", "case": "hoesje",
  "cover": "hoes", "protector": "beschermer", "holder": "houder",
  "stand": "standaard", "mount": "houder", "dock": "docking",
  "hub": "hub", "drive": "schijf", "flash": "flash", "memory": "geheugen",
  "storage": "opslag", "external": "extern", "portable": "draagbaar",
  "printer": "printer", "ink": "inkt", "cartridge": "cartridge",
  "paper": "papier", "camera": "camera", "lens": "lens",
  "tripod": "statief", "light": "lamp", "bulb": "lamp",
  "smart": "slim", "remote": "afstandsbediening", "control": "bediening",
  // Personal care
  "shampoo": "shampoo", "conditioner": "conditioner", "soap": "zeep",
  "cream": "crème", "lotion": "lotion", "sunscreen": "zonnebrandcrème",
  "toothbrush": "tandenborstel", "toothpaste": "tandpasta",
  "razor": "scheermesje", "deodorant": "deodorant", "perfume": "parfum",
  "moisturizer": "vochtinbrenger", "cleanser": "reiniger",
  "body": "lichaam", "face": "gezicht", "hair": "haar", "skin": "huid",
  "nail": "nagel", "lip": "lip", "eye": "oog",
  // Kitchen & home
  "blender": "blender", "mixer": "mixer", "oven": "oven",
  "kettle": "waterkoker", "toaster": "broodrooster",
  "coffee": "koffie", "maker": "machine", "machine": "machine",
  "vacuum": "stofzuiger", "cleaner": "reiniger", "iron": "strijkijzer",
  "pillow": "kussen", "blanket": "deken", "towel": "handdoek",
  "bottle": "fles", "container": "container", "jar": "pot",
  // Materials & attributes
  "black": "zwart", "white": "wit", "blue": "blauw", "red": "rood",
  "green": "groen", "grey": "grijs", "gray": "grijs", "silver": "zilver",
  "gold": "goud", "pink": "roze", "purple": "paars", "orange": "oranje",
  "steel": "staal", "stainless": "roestvrijstalen", "glass": "glas",
  "plastic": "kunststof", "leather": "leer", "wooden": "houten",
  "wood": "hout", "metal": "metaal", "rubber": "rubber",
  "waterproof": "waterdicht", "rechargeable": "oplaadbaar",
  "adjustable": "verstelbaar", "foldable": "opvouwbaar",
  // Books
  "book": "boek", "paperback": "paperback", "hardcover": "hardcover",
  "edition": "editie", "novel": "roman", "guide": "gids",
  "cookbook": "kookboek", "children": "kinderen", "kids": "kinderen",
  // Sizes
  "small": "klein", "medium": "medium", "large": "groot",
  "extra": "extra", "mini": "mini", "set": "set", "pack": "pak",
  "pair": "paar", "pieces": "stuks", "count": "stuks",
  // Fitness & sports
  "fitness": "fitness", "yoga": "yoga", "exercise": "oefening",
  "training": "training", "weights": "gewichten", "mat": "mat",
  "resistance": "weerstand", "band": "band", "bands": "banden",
  // Baby & kids
  "baby": "baby", "stroller": "kinderwagen", "diaper": "luier",
  "diapers": "luiers", "pacifier": "fopspeen", "bottle": "fles",
  "toy": "speelgoed", "toys": "speelgoed", "puzzle": "puzzel",
  "game": "spel", "games": "spellen",
  // Garden & outdoor
  "garden": "tuin", "outdoor": "buiten", "indoor": "binnen",
  "plant": "plant", "pot": "pot", "tools": "gereedschap", "tool": "gereedschap",
  // Food & drink
  "organic": "biologisch", "sugar": "suiker", "free": "vrij",
  "protein": "eiwit", "vitamin": "vitamine", "supplement": "supplement",
  "capsules": "capsules", "tablets": "tabletten",
  // Pet
  "dog": "hond", "cat": "kat", "pet": "huisdier", "food": "voer",
  "treat": "snoepje", "treats": "snoepjes", "collar": "halsband",
  "leash": "riem",
  // Clothing
  "shirt": "shirt", "pants": "broek", "jacket": "jas", "coat": "jas",
  "shoes": "schoenen", "boots": "laarzen", "socks": "sokken",
  "underwear": "ondergoed", "dress": "jurk", "sweater": "trui",
  // Electronics modifiers
  "pro": "pro", "plus": "plus", "max": "max", "lite": "lite",
  "ultra": "ultra",
};

/**
 * Translate a search query from English to Dutch using dictionary.
 * Keeps brand names, model numbers, and untranslatable terms intact.
 */
function translateToNL(query) {
  const words = query.split(/\s+/);
  let translated = false;
  const result = words.map((word) => {
    const lower = word.toLowerCase();
    if (EN_NL_DICT[lower] && EN_NL_DICT[lower] !== lower) {
      translated = true;
      return EN_NL_DICT[lower];
    }
    return word;
  });
  return translated ? result.join(" ") : null; // null = no change
}

// ═══════════════════════════════════════════════════════════════
// TITLE CLEANING
// ═══════════════════════════════════════════════════════════════

function cleanTitle(title, maxWords) {
  let t = title
    .replace(/\(.*?\)/g, " ").replace(/\[.*?\]/g, " ").replace(/\{.*?\}/g, " ")
    .replace(/\|.*$/g, "").replace(/\s[-–—]\s.*$/g, "")
    .replace(/,\s*(zwart|wit|black|white|grijs|grey|silver|zilver|blauw|blue|rood|red|groen|green|roze|pink|goud|gold|paars|purple)$/i, "")
    .replace(/\b(nieuw!?|bestseller|aanbieding|sale|limited\s*edition|exclusive)\b/gi, "")
    .replace(/\b\d+\s*x\s*\d+\s*x?\s*\d*\s*(cm|mm|m|inch)?\b/gi, "")
    .replace(/\bvoor\s+\w+.*$/i, "").replace(/\bfor\s+\w+.*$/i, "")
    .replace(/[,;:]+\s*$/, "").replace(/\s{2,}/g, " ").trim();
  const words = t.split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(" ") : t;
}

function cleanBrand(brand) {
  if (!brand) return "";
  return brand
    // Book roles (NL + EN)
    .replace(/\(auteur\)/gi, "").replace(/\(vertaler?\)/gi, "")
    .replace(/\(author\)/gi, "").replace(/\(translator?\)/gi, "")
    .replace(/\(redactie\)/gi, "").replace(/\(editor\)/gi, "")
    .replace(/\(illustrator\)/gi, "")
    // Dutch Amazon prefixes: "Bezoek de X", "De X Store openen"
    .replace(/^(bezoek de |de )/gi, "")
    // English Amazon prefixes
    .replace(/^(visit the |brand:\s*|merk:\s*)/gi, "")
    // Trailing store/shop + optional verb: "Store openen", "Store bezoeken", "Store Page"
    .replace(/\s*[-\s]*(store|winkel|shop|brand|official|merk)\s*(openen|bezoeken|pagina|page)?\s*$/gi, "")
    // Take only first part before comma (removes co-authors, sub-brands)
    .replace(/,.*$/g, "")
    // Remove trademark symbols
    .replace(/[™®©]/g, "")
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// WEIGHTED MATCHING — brand/author/specs get extra weight
// ═══════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  "de","het","een","en","van","voor","met","in","op","aan","bij","uit",
  "the","a","an","and","of","for","with","on","to","by","is","at","or","as",
  "it","its","this","that","from","-","–","|","/","&","+",
]);

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[™®©\(\)\[\]\{\}]/g, " ")
    .replace(/[^a-z0-9àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ\s]/g, " ")
    .split(/\s+/)
    .filter(w => {
      if (STOP_WORDS.has(w)) return false;
      if (w.length >= 2) return true;
      // Allow single digits — they differentiate product versions (Flip 6 vs 5)
      if (/^\d$/.test(w)) return true;
      return false;
    });
}

/**
 * Model qualifiers — words that almost always indicate a product VARIANT.
 * These are distinct from descriptive words like "ultra" or "mini" which
 * can be part of a product's base name (e.g. "Ultra Mini LED").
 */
const VARIANT_QUALIFIERS = new Set([
  "pro", "plus", "max", "lite", "se", "air", "neo", "evo",
  "slim", "elite", "prime", "basic", "advanced", "premium", "classic",
  "ii", "iii", "iv", "gen", "mk", "gt", "xl", "xs", "xt",
]);

/**
 * Classify a token for weighting purposes.
 * - brand:     3× — the manufacturer name
 * - variant:   3× — variant qualifiers (Pro/Plus/Max) that differentiate product lines
 * - prodname:  2.5× — core product name words (positions 1-3 after brand in title)
 * - spec:      2× — numbers and units (64gb, 500ml, 530lm)
 * - generic:   1× — common descriptive words
 */
function classifyToken(word, brand) {
  const brandTokens = brand ? tokenize(brand) : [];
  if (brandTokens.includes(word)) return "brand";

  // Variant qualifiers — always critical
  if (VARIANT_QUALIFIERS.has(word)) return "variant";

  // Spec-like: numbers, units, model numbers
  if (/^\d+/.test(word)) return "spec";
  if (/^(gb|tb|mb|ml|cl|kg|mm|cm|watt|mah|rpm|lm|lumen)$/i.test(word)) return "spec";

  return "generic";
}

/**
 * Extract the "product name" words from a title — the core identity words
 * that appear right after the brand. These get extra weight because they
 * identify WHICH product it is (e.g. "OClip Pro" in "OLIGHT OClip Pro Ultra Mini LED...").
 *
 * Returns a Set of tokens that are considered the product name.
 */
function extractProductNameTokens(title, brand) {
  const tokens = tokenize(title);
  const brandTokens = brand ? new Set(tokenize(brand)) : new Set();

  // Skip brand tokens at the start, then take the next 2 meaningful words
  // as the product name. Stop at clearly descriptive transitions.
  const DESCRIPTION_BOUNDARY = new Set([
    // Tech descriptors
    "led", "usb", "bluetooth", "wireless", "draadloos", "oplaadbaar",
    "rechargeable", "waterproof", "waterdicht", "stainless", "portable",
    "draagbaar", "electric", "elektrisch", "elektrische", "digital", "digitaal",
    // Size/quality adjectives (NOT product names)
    "ultra", "mini", "micro", "nano", "super", "mega", "compact",
    "klein", "groot", "large", "small", "medium",
    // Product category words (NL + EN)
    "zaklamp", "koptelefoon", "luidspreker", "toetsenbord", "oplader",
    "flashlight", "headphones", "speaker", "keyboard", "charger",
    "monitor", "printer", "camera", "tablet", "lamp", "horloge",
    // Connective / descriptive
    "voor", "for", "met", "with", "gemaakt", "made",
  ]);

  const prodNameTokens = new Set();
  let collected = 0;

  for (const token of tokens) {
    if (brandTokens.has(token)) continue; // skip brand words
    if (collected >= 2) break;
    if (DESCRIPTION_BOUNDARY.has(token)) break; // hit descriptive zone
    prodNameTokens.add(token);
    collected++;
  }

  return prodNameTokens;
}

/**
 * Weighted title similarity with positional product-name boosting.
 * Returns { score: 0–1, matchedTerms: [], missingTerms: [], differingSpecs: [] }
 *
 * Weighting strategy:
 * - Brand words: 3×
 * - Variant qualifiers (pro/plus/max): 3×
 * - Product name words (first 3 after brand): 2.5×
 * - Spec words (numbers/units): 2×
 * - Everything else: 1×
 *
 * Also applies a penalty when bol title contains variant/spec terms
 * not present in the Amazon title (suggests a different product variant).
 */
function weightedSimilarity(amazonTitle, bolTitle, brand) {
  const aTokens = tokenize(amazonTitle);
  const bTokens = tokenize(bolTitle);

  if (!aTokens.length || !bTokens.length) return { score: 0, matchedTerms: [], missingTerms: [], differingSpecs: [] };

  const prodNameTokens = extractProductNameTokens(amazonTitle, brand);
  const bSet = new Set(bTokens);
  let matchedWeight = 0, totalWeight = 0;
  const matchedTerms = [], missingTerms = [], differingSpecs = [];

  for (const word of aTokens) {
    const cls = classifyToken(word, brand);
    let multiplier;
    if (cls === "brand") multiplier = 3;
    else if (cls === "variant") multiplier = 3;
    else if (prodNameTokens.has(word)) multiplier = 2.5;
    else if (cls === "spec") multiplier = 2;
    else multiplier = 1;

    // Numeric tokens get minimum base weight of 3 — "6" differentiates Flip 6 from Flip 5
    const baseWeight = /^\d+$/.test(word)
      ? Math.max(3, Math.min(word.length, 8))
      : Math.min(word.length, 8);
    const weight = baseWeight * multiplier;
    totalWeight += weight;

    if (bSet.has(word)) {
      matchedWeight += weight;
      matchedTerms.push(word);
      continue;
    }

    // Partial match
    let partialFound = false;
    for (const bWord of bTokens) {
      if (bWord.startsWith(word) || word.startsWith(bWord)) {
        matchedWeight += weight * 0.7;
        matchedTerms.push(word);
        partialFound = true;
        break;
      }
    }

    if (!partialFound) {
      missingTerms.push(word);
      if (cls === "spec" || cls === "variant" || prodNameTokens.has(word)) {
        differingSpecs.push(word);
      }
    }
  }

  // Bidirectional check: penalize if bol title has variant/spec terms NOT in Amazon title.
  const aSet = new Set(aTokens);
  const bolProdNameTokens = extractProductNameTokens(bolTitle, brand);
  let extraPenalty = 0;
  for (const bWord of bTokens) {
    if (!aSet.has(bWord)) {
      const cls = classifyToken(bWord, brand);
      if (cls === "variant") {
        // Bol has a variant qualifier not in Amazon → likely different product line
        extraPenalty += Math.min(bWord.length, 8) * 2;
      } else if (cls === "spec") {
        extraPenalty += Math.min(bWord.length, 8) * 0.5;
      } else if (bolProdNameTokens.has(bWord)) {
        // Bol product name word not in Amazon → different product
        extraPenalty += Math.min(bWord.length, 8) * 1.5;
      }
    }
  }

  const rawScore = totalWeight > 0 ? matchedWeight / totalWeight : 0;
  const penaltyFactor = totalWeight > 0 ? Math.max(0, 1 - (extraPenalty / (totalWeight * 0.5))) : 1;
  const score = rawScore * penaltyFactor;

  return { score, matchedTerms, missingTerms, differingSpecs };
}

/**
 * Cross-language similarity: compute EN match + NL match (if translatable),
 * return the best one with metadata.
 */
function crossLangSimilarity(amazonTitle, bolTitle, brand) {
  const enResult = weightedSimilarity(amazonTitle, bolTitle, brand);
  enResult.lang = "en";

  // Try NL translation of the Amazon title
  const nlTitle = translateToNL(amazonTitle);
  if (nlTitle) {
    const nlResult = weightedSimilarity(nlTitle, bolTitle, brand);
    nlResult.lang = "nl";
    if (nlResult.score > enResult.score) return nlResult;
  }

  return enResult;
}

/**
 * Validate and score results, keeping those above threshold.
 */
function validateAndScoreResults(results, amazonTitle, brand, isProductCode) {
  if (isProductCode) {
    // Still compute scores for display, but don't filter
    for (const r of results) {
      const sim = crossLangSimilarity(amazonTitle, r.title, brand);
      r.matchScore = Math.round(sim.score * 100);
      r.matchLang = sim.lang;
      r.differingSpecs = sim.differingSpecs;
      r.missingTerms = sim.missingTerms;
    }
    return results;
  }

  const MIN_SCORE = 0.20;
  return results.filter(r => {
    const sim = crossLangSimilarity(amazonTitle, r.title, brand);
    r.matchScore = Math.round(sim.score * 100);
    r.matchLang = sim.lang;
    r.differingSpecs = sim.differingSpecs;
    r.missingTerms = sim.missingTerms;

    const pass = sim.score >= MIN_SCORE;
    if (!pass) console.log(`[${SS}] Rejected: "${r.title.substring(0, 50)}…" (${r.matchScore}%)`);
    return pass;
  });
}

// ═══════════════════════════════════════════════════════════════
// QUANTITY / SPEC EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractQuantities(title) {
  if (!title) return {};
  const t = title.toLowerCase();
  const q = {};

  const storage = t.match(/(\d+)\s*(gb|tb|mb)/i);
  if (storage) { let v = parseFloat(storage[1]); const u = storage[2].toLowerCase(); if (u==="tb") v*=1024; if (u==="mb") v/=1024; q.storage_gb = v; }

  const weight = t.match(/(\d+[.,]?\d*)\s*(kg|gram|g|mg|lbs?|oz)\b/i);
  if (weight) { let v = parseFloat(weight[1].replace(",",".")); const u = weight[2].toLowerCase(); if (u==="kg") v*=1000; if (u==="mg") v/=1000; if (u==="lb"||u==="lbs") v*=453.6; if (u==="oz") v*=28.35; q.weight_g = Math.round(v*100)/100; }

  const volume = t.match(/(\d+[.,]?\d*)\s*(ml|liter|l|cl|fl\.?\s?oz)\b/i);
  if (volume) { let v = parseFloat(volume[1].replace(",",".")); const u = volume[2].toLowerCase().replace(/\s/g,""); if (u==="l"||u==="liter") v*=1000; if (u==="cl") v*=10; if (u==="fl.oz"||u==="floz") v*=29.57; q.volume_ml = Math.round(v*100)/100; }

  const packPats = [/(\d+)\s*[-\s]?\s*(?:pack|pak)\b/i, /pack\s*(?:of|van)\s*(\d+)/i, /(\d+)\s*x\b/i, /\bx\s*(\d+)\b/i, /(\d+)\s*(?:stuks?|pieces?|count|st)\b/i, /(\d+)\s*(?:capsules?|tablets?|tabs)\b/i];
  for (const pat of packPats) { const m = t.match(pat); if (m) { const c = parseInt(m[1]); if (c > 1 && c < 500) { q.pack_count = c; break; } } }

  const len = t.match(/(\d+[.,]?\d*)\s*(mm|cm|m|inch|")\b/i);
  if (len) { let v = parseFloat(len[1].replace(",",".")); const u = len[2].toLowerCase(); if (u==="m"&&v<100) v*=100; if (u==="mm") v/=10; if (u==="inch"||u==='"') v*=2.54; q.length_cm = Math.round(v*100)/100; }

  const watt = t.match(/(\d+[.,]?\d*)\s*(w|watt)\b/i);
  if (watt) { const v = parseFloat(watt[1].replace(",",".")); if (v > 0 && v < 10000) q.wattage_w = v; }

  const mah = t.match(/(\d+)\s*mah\b/i);
  if (mah) { const v = parseInt(mah[1]); if (v > 0) q.battery_mah = v; }

  return q;
}

const SPEC_LABELS = {
  storage_gb: "Storage", weight_g: "Weight", volume_ml: "Volume",
  pack_count: "Pack size", length_cm: "Size",
  wattage_w: "Wattage", battery_mah: "Battery",
};

function formatSpecValue(key, val) {
  if (key === "storage_gb") return val >= 1024 ? `${val/1024}TB` : `${val}GB`;
  if (key === "weight_g") return val >= 1000 ? `${(val/1000).toFixed(1)}kg` : `${val}g`;
  if (key === "volume_ml") return val >= 1000 ? `${(val/1000).toFixed(1)}L` : `${val}ml`;
  if (key === "pack_count") return `${val}x`;
  if (key === "length_cm") return `${val}cm`;
  if (key === "wattage_w") return `${val}W`;
  if (key === "battery_mah") return `${val}mAh`;
  return String(val);
}

/**
 * Determine match type and find differing specs with labels.
 * Returns { type: "exact"|"approximate", specDiffs: [...] }
 */
function analyzeMatchType(amazonTitle, bolTitle) {
  const aq = extractQuantities(amazonTitle);
  const bq = extractQuantities(bolTitle);
  const aKeys = Object.keys(aq), bKeys = Object.keys(bq);

  if (!aKeys.length && !bKeys.length) return { type: "exact", specDiffs: [] };

  const specDiffs = [];
  let hasMismatch = false;

  for (const key of aKeys) {
    if (key in bq) {
      const ratio = aq[key] / bq[key];
      if (ratio < 0.95 || ratio > 1.05) {
        hasMismatch = true;
        specDiffs.push({
          label: SPEC_LABELS[key] || key,
          amazon: formatSpecValue(key, aq[key]),
          bol: formatSpecValue(key, bq[key]),
        });
      }
    }
  }

  // Check for pack_count present on one side but not the other
  for (const key of bKeys) {
    if (!(key in aq) && key === "pack_count" && bq[key] > 1) {
      hasMismatch = true;
      specDiffs.push({ label: SPEC_LABELS[key], amazon: "1x", bol: formatSpecValue(key, bq[key]) });
    }
  }
  for (const key of aKeys) {
    if (!(key in bq) && key === "pack_count" && aq[key] > 1) {
      hasMismatch = true;
      specDiffs.push({ label: SPEC_LABELS[key], amazon: formatSpecValue(key, aq[key]), bol: "1x" });
    }
  }

  return { type: hasMismatch ? "approximate" : "exact", specDiffs };
}

/**
 * Compute spec compatibility factor (0.0–1.0) between two titles.
 * For each spec present in both, ratio = min/max (symmetric, 0–1).
 * Missing pack_count treated as 1. No comparable specs → 1.0 (no penalty).
 */
function computeSpecCompatibility(amazonTitle, bolTitle) {
  const aq = extractQuantities(amazonTitle);
  const bq = extractQuantities(bolTitle);

  // Treat missing pack_count as 1
  if (("pack_count" in aq) && !("pack_count" in bq)) bq.pack_count = 1;
  if (("pack_count" in bq) && !("pack_count" in aq)) aq.pack_count = 1;

  const allKeys = new Set([...Object.keys(aq), ...Object.keys(bq)]);
  const ratios = [];

  for (const key of allKeys) {
    if (key in aq && key in bq) {
      const a = aq[key], b = bq[key];
      if (a > 0 && b > 0) ratios.push(Math.min(a, b) / Math.max(a, b));
    }
  }

  return ratios.length > 0 ? ratios.reduce((s, v) => s + v, 0) / ratios.length : 1.0;
}

/**
 * Compute composite rank score combining text similarity, spec compatibility, and price proximity.
 * rankScore = matchScore × specFactor × priceFactor
 */
function computeRankScore(result, amazonTitle, amazonPrice) {
  const matchFactor = (result.matchScore || 0) / 100;
  const specFactor = computeSpecCompatibility(amazonTitle, result.title);

  let priceFactor = 1.0;
  if (result.price != null && amazonPrice != null && result.price > 0 && amazonPrice > 0) {
    const ratio = Math.max(result.price, amazonPrice) / Math.min(result.price, amazonPrice);
    if (ratio <= 2.0) {
      priceFactor = 1.0;
    } else if (ratio <= 4.0) {
      // Linear interpolation: 2.0 → 1.0, 4.0 → 0.6
      priceFactor = 1.0 - (ratio - 2.0) * (0.4 / 2.0);
    } else {
      priceFactor = 0.5;
    }
  }

  result.rankScore = Math.round(matchFactor * specFactor * priceFactor * 1000) / 1000;
  console.log(`[${SS}] rankScore=${result.rankScore} (match=${matchFactor.toFixed(2)}, spec=${specFactor.toFixed(2)}, price=${priceFactor.toFixed(2)}) "${result.title.substring(0, 50)}"`);
  return result.rankScore;
}

// ═══════════════════════════════════════════════════════════════
// UPCITEMDB EAN LOOKUP
// ═══════════════════════════════════════════════════════════════

async function lookupEanViaUpcItemDb(product) {
  try {
    const brand = cleanBrand(product.brand);
    const title = cleanTitle(product.title || "", 6);
    let query = title;
    if (brand && !title.toLowerCase().includes(brand.toLowerCase())) query = `${brand} ${title}`;
    if (!query.trim()) return null;

    const url = `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(query)}&match_mode=0&type=product`;
    console.log(`[${SS}] UPCitemdb: "${query}"`);

    const resp = await fetch(url, { headers: { "Content-Type": "application/json", "Accept": "application/json" } });
    if (!resp.ok) { console.warn(`[${SS}] UPCitemdb ${resp.status}`); return null; }

    const data = await resp.json();
    if (!data.items?.length) return null;

    const amazonTitle = product.title || "";
    let bestEan = null, bestScore = 0;

    for (const item of data.items) {
      if (!item.ean || item.ean.length < 8) continue;
      const sim = crossLangSimilarity(amazonTitle, item.title || "", cleanBrand(product.brand));
      if (sim.score > bestScore) { bestScore = sim.score; bestEan = item.ean; }
    }

    if (bestScore >= 0.2 && bestEan) {
      console.log(`[${SS}] UPCitemdb → EAN ${bestEan} (${(bestScore*100).toFixed(0)}%)`);
      return bestEan;
    }
    return null;
  } catch (err) {
    console.warn(`[${SS}] UPCitemdb error:`, err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// BOL.COM SEARCH ENGINE
// ═══════════════════════════════════════════════════════════════

function buildSearchQueries(product) {
  const queries = [];
  if (product.ean) queries.push({ query: product.ean, label: "EAN", isProductCode: true });
  if (product.isbn10 && !product.ean) queries.push({ query: product.isbn10, label: "ISBN-10", isProductCode: true });

  const cleaned = cleanTitle(product.title || "", 8);
  const brand = cleanBrand(product.brand);
  let specific = cleaned;
  if (brand && !cleaned.toLowerCase().includes(brand.toLowerCase())) specific = `${brand} ${cleaned}`;
  if (specific.trim()) queries.push({ query: specific.trim(), label: "specific-EN", isProductCode: false });

  // Dutch translation of specific query
  const nlSpecific = translateToNL(specific.trim());
  if (nlSpecific) queries.push({ query: nlSpecific, label: "specific-NL", isProductCode: false });

  const broad = cleanTitle(product.title || "", 6);
  if (broad.trim() && broad.trim() !== specific.trim()) {
    queries.push({ query: broad.trim(), label: "broad-EN", isProductCode: false });
    const nlBroad = translateToNL(broad.trim());
    if (nlBroad) queries.push({ query: nlBroad, label: "broad-NL", isProductCode: false });
  }

  return queries;
}

async function searchBolCom(product) {
  const queries = buildSearchQueries(product);
  const brand = cleanBrand(product.brand);

  console.log(`[${SS}] Cascade:`, queries.map(q => `${q.label}: "${q.query}"`));

  const codeQueries = queries.filter(q => q.isProductCode);
  const textQueries = queries.filter(q => !q.isProductCode);

  // Phase 1: Product codes
  for (const { query, label } of codeQueries) {
    const r = await tryBolSearch(query, label, product, brand, true);
    if (r) return r;
  }

  // Phase 2: UPCitemdb EAN lookup
  if (!product.ean && !product.isbn10) {
    const ean = await lookupEanViaUpcItemDb(product);
    if (ean) {
      const r = await tryBolSearch(ean, "UPCitemdb-EAN", product, brand, true);
      if (r) return r;
    }
  }

  // Phase 3: Text searches (EN + NL interleaved) — collect ALL results, pick best
  const allCandidates = [];
  for (const { query, label } of textQueries) {
    const r = await tryBolSearch(query, label, product, brand, false, true);
    if (r) allCandidates.push(...r.results.map(res => ({ ...res, searchMethod: label, searchUrl: r.searchUrl })));
  }

  if (allCandidates.length > 0) {
    // Deduplicate by URL, keeping highest score
    const byUrl = {};
    for (const c of allCandidates) {
      const key = c.url.split("?")[0];
      if (!byUrl[key] || c.matchScore > byUrl[key].matchScore) byUrl[key] = c;
    }

    // Compute initial rank scores (some candidates may already have prices from tryBolSearch)
    const deduped = Object.values(byUrl);
    for (const r of deduped) computeRankScore(r, product.title || "", product.price);
    deduped.sort((a, b) => b.rankScore - a.rankScore);

    let best = deduped[0];
    let alternative = deduped.length > 1 ? deduped[1] : null;

    // Ensure details are fetched for the picks (may not have been in a top-2 slice)
    const amazonTitle = product.title || "";
    const brand = cleanBrand(product.brand);
    const toFetch = [best, alternative].filter(r => r && r.price == null);
    if (toFetch.length) {
      await Promise.allSettled(toFetch.map(async (r) => {
        const details = await fetchBolProductDetails(r.url);
        if (details !== null) {
          r.price = details.price;
          r.available = details.available;
          if (details.fullTitle) {
            r.title = details.fullTitle;
            const sim = crossLangSimilarity(amazonTitle, r.title, brand);
            r.matchScore = Math.round(sim.score * 100);
            r.matchLang = sim.lang;
            r.differingSpecs = sim.differingSpecs;
            r.missingTerms = sim.missingTerms;
            console.log(`[${SS}] Re-scored with full title: "${r.title.substring(0, 60)}…" → ${r.matchScore}%`);
          }
        }
      }));
    }

    // Re-compute rank scores with updated titles/prices, and swap if needed
    computeRankScore(best, amazonTitle, product.price);
    if (alternative) computeRankScore(alternative, amazonTitle, product.price);
    if (alternative && alternative.rankScore > best.rankScore) {
      [best, alternative] = [alternative, best];
    }

    // Analyze match type with (potentially updated) titles
    for (const r of [best, alternative].filter(Boolean)) {
      const analysis = analyzeMatchType(amazonTitle, r.title);
      r.matchType = analysis.type;
      r.specDiffs = analysis.specDiffs;
    }

    return {
      results: [best],
      alternative,
      searchUrl: best.searchUrl || `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(product.title || "")}`,
      searchMethod: best.searchMethod,
    };
  }

  const lastQuery = queries[queries.length - 1]?.query || product.title || "";
  return {
    results: [],
    alternative: null,
    searchUrl: `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(lastQuery)}`,
    searchMethod: "none",
  };
}

async function tryBolSearch(query, label, product, brand, isProductCode, collectMode = false) {
  const searchUrl = `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(query)}`;
  console.log(`[${SS}] Trying ${label}: ${query}`);

  try {
    const resp = await fetch(searchUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!resp.ok) return null;

    const html = await resp.text();
    const bolData = parseBolResults(html, searchUrl);
    const amazonTitle = product.title || "";

    bolData.results = validateAndScoreResults(bolData.results, amazonTitle, brand, isProductCode);
    if (!bolData.results.length) return null;

    console.log(`[${SS}] ${bolData.results.length} validated via ${label}`);
    bolData.searchMethod = label;

    // Fetch product details (price, availability, full title) for top results
    const topN = collectMode ? bolData.results.slice(0, 2) : bolData.results.slice(0, 3);
    await Promise.allSettled(topN.map(async (r) => {
      const details = await fetchBolProductDetails(r.url);
      if (details !== null) {
        r.price = details.price;
        r.available = details.available;
        if (details.fullTitle) {
          r.title = details.fullTitle;
          // Re-score with full title for more accurate matching
          const sim = crossLangSimilarity(amazonTitle, r.title, brand);
          r.matchScore = Math.round(sim.score * 100);
          r.matchLang = sim.lang;
          r.differingSpecs = sim.differingSpecs;
          r.missingTerms = sim.missingTerms;
          console.log(`[${SS}] Re-scored with full title: "${r.title.substring(0, 60)}…" → ${r.matchScore}%`);
        }
      }
    }));

    // Analyze match type
    for (const r of bolData.results) {
      const analysis = analyzeMatchType(amazonTitle, r.title);
      r.matchType = analysis.type;
      r.specDiffs = analysis.specDiffs;
    }

    if (!collectMode) {
      // Compute composite rank scores and sort by them
      for (const r of bolData.results) computeRankScore(r, amazonTitle, product.price);
      bolData.results.sort((a, b) => b.rankScore - a.rankScore);
      bolData.alternative = bolData.results.length > 1 ? bolData.results[1] : null;
      bolData.results = [bolData.results[0]];
    }

    return bolData;
  } catch (err) {
    console.warn(`[${SS}] ${label} failed:`, err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// BOL.COM HTML PARSING
// ═══════════════════════════════════════════════════════════════

function parseBolResults(html, searchUrl) {
  const results = [];
  const regex = /<a[^>]*href="(\/nl\/nl\/p\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  let m;

  while ((m = regex.exec(html)) !== null) {
    const relUrl = m[1];
    const text = m[2].replace(/<[^>]*>/g, "").trim();
    if (!text || text.length < 5) continue;
    const cleanUrl = relUrl.split("?")[0];
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    results.push({ title: text.substring(0, 200), url: `https://www.bol.com${relUrl}`, price: null });
    if (results.length >= 5) break;
  }

  return { results, searchUrl, query: decodeURIComponent(searchUrl.split("searchtext=")[1] || "") };
}

async function fetchBolProductDetails(productUrl) {
  try {
    const resp = await fetch(productUrl, {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    let price = null;
    let available = true; // default: assume available if no signal found
    let fullTitle = null;

    // JSON-LD — extract price, availability, and base title
    let jsonLdTitle = null;
    for (const jm of [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]) {
      try {
        const data = JSON.parse(jm[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "Product") {
            if (item.name) jsonLdTitle = item.name;
            if (item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
              for (const o of offers) {
                if (o.availability) {
                  const avail = o.availability.replace(/^https?:\/\/schema\.org\//, "");
                  const inStockValues = ["InStock", "OnlineOnly", "PreOrder", "LimitedAvailability"];
                  available = inStockValues.includes(avail);
                }
                if (price == null) {
                  const p = parseFloat(o.price || o.lowPrice);
                  if (!isNaN(p) && p > 0) price = p;
                }
              }
            }
          }
        }
      } catch(e) {}
    }

    // Full title: prefer <h1> (contains title + subtitle), fall back to JSON-LD name, then og:title
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      const h1Text = h1Match[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (h1Text.length >= 3) fullTitle = h1Text;
    }
    if (!fullTitle && jsonLdTitle) {
      fullTitle = jsonLdTitle;
    }
    if (!fullTitle) {
      const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      if (ogTitle) fullTitle = ogTitle[1];
    }
    // Strip pipe-separated metadata (EAN codes, categories like "| 9493213870 | Boeken")
    if (fullTitle) fullTitle = fullTitle.replace(/\s*\|.*$/, "").trim();

    // Fallback price: meta tags
    if (price == null) {
      const metaM = html.match(/<meta[^>]*(?:property|name)="(?:og:price:amount|product:price:amount)"[^>]*content="([^"]+)"/i);
      if (metaM) { const p = parseFloat(metaM[1].replace(",",".")); if (!isNaN(p) && p > 0) price = p; }
    }

    // Fallback price: promo price
    if (price == null) {
      const promoM = html.match(/class="promo-price"[^>]*>(\d{1,5})<\/span>\s*<sup[^>]*>(\d{2})<\/sup>/i);
      if (promoM) { const p = parseFloat(`${promoM[1]}.${promoM[2]}`); if (!isNaN(p) && p > 0) price = p; }
    }

    // Fallback price: script price
    if (price == null) {
      const scriptM = html.match(/"(?:currentPrice|price|salePrice)":\s*["]?(\d+[.,]\d{2})["]?/i);
      if (scriptM) { const p = parseFloat(scriptM[1].replace(",",".")); if (!isNaN(p) && p > 0) price = p; }
    }

    return { price, available, fullTitle };
  } catch (err) { return null; }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLING
// ═══════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PRODUCT_DETECTED" && sender.tab) {
    const tabId = sender.tab.id;
    const product = msg.product;

    badge.loading(tabId);
    resultsByTab[tabId] = { status: "loading", amazonProduct: product, bolResults: null, error: null };

    searchBolCom(product).then(async (bolData) => {
      const settings = await getSettings();
      const found = bolData.results.length > 0;

      resultsByTab[tabId] = {
        status: found ? "found" : "not_found",
        amazonProduct: product,
        bolResults: bolData,
        alternative: bolData.alternative || null,
        error: null,
      };

      if (found) {
        const best = bolData.results[0];
        const mt = best.matchType || "exact";
        const bp = best.price, ap = product.price;

        if (mt === "approximate") badge.approx(tabId);
        else if (settings.badgeStyle === "price") {
          if (bp != null && ap != null) {
            if (bp < ap) badge.cheaper(tabId);
            else if (bp > ap) badge.pricier(tabId);
            else badge.found(tabId);
          } else badge.noPrice(tabId);
        } else badge.found(tabId);
      } else badge.notFound(tabId);

      persist(tabId);
      console.log(`[${SS}] ${found ? "Found" : "No match"} for "${product.title?.substring(0, 50)}"`);
    }).catch((err) => {
      console.error(`[${SS}] Error:`, err);
      resultsByTab[tabId] = { status: "error", amazonProduct: product, bolResults: null, error: err.message };
      badge.error(tabId);
      persist(tabId);
    });

    sendResponse({ received: true });
  }

  if (msg.type === "GET_RESULTS") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) { sendResponse({ status: "no_data" }); return; }
      let data = resultsByTab[tabId];
      if (!data) data = await loadPersisted(tabId);
      sendResponse(data || { status: "no_data" });
    });
    return true;
  }

  if (msg.type === "GET_SETTINGS") {
    getSettings().then(s => sendResponse(s));
    return true;
  }

  if (msg.type === "SAVE_SETTINGS") {
    chrome.storage.sync.set({ shopswitch_settings: msg.settings }, () => sendResponse({ ok: true }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete resultsByTab[tabId];
  chrome.storage.session.remove(`tab_${tabId}`);
});
