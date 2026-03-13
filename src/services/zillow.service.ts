import axios from "axios";
import { env } from "../config/env.js";

export interface ZillowPropertyData {
  // ── Basic ──
  title: string;
  location: string;
  price: number;
  description: string;
  highlights: string[];
  beds?: number;
  baths?: number;
  sqft?: number;
  images: string[];
  zpid: string;
  zillowUrl: string;
  /** All raw facts captured from the page, grouped by section name.
   *  Keys are Zillow section headers (e.g. "Interior", "Exterior").
   *  Values are { label: value } maps of every fact found under that section.
   *  Used to render a dynamic preview on the frontend. */
  factsAndFeatures: Record<string, Record<string, string>>;

  /** Debug info — shows what each extraction layer captured.
   *  Remove or ignore this on the frontend; it's for debugging only. */
  _debug?: {
    metaTitle: string;
    metaDesc: string;
    hasNextData: boolean;
    hasResoFacts: boolean;
    renderedTextSample: string;
    factSectionCount: number;
    factTotalCount: number;
  };

  // ── Construction ──
  yearBuilt?: number;
  homeType?: string;
  propertySubtype?: string;
  constructionMaterials?: string[];
  foundation?: string[];
  roof?: string[];

  // ── Interior ──
  fullBathrooms?: number;
  heating?: string[];
  cooling?: string[];
  appliancesIncluded?: string[];
  laundry?: string[];
  interiorFeatures?: string[];
  flooring?: string[];
  basement?: string;
  fireplaceCount?: number;
  fireplaceFeatures?: string[];
  totalLivableArea?: string;

  // ── Exterior ──
  stories?: number;
  levels?: string;
  patioAndPorch?: string[];
  exteriorFeatures?: string[];
  poolFeatures?: string[];
  hasSpa?: boolean;
  spaFeatures?: string[];
  fencing?: string[];

  // ── Lot ──
  lotFeatures?: string[];
  parcelNumber?: string;

  // ── Utilities ──
  sewer?: string[];
  water?: string[];
  utilitiesForProperty?: string[];

  // ── Community & HOA ──
  communityFeatures?: string[];
  hasHOA?: boolean;
  hoaFee?: string;
  subdivision?: string;

  // ── Financial / Listing ──
  pricePerSqft?: string;
  zestimate?: string;
  rentZestimate?: string;
  estimatedSalesRangeLow?: string;
  estimatedSalesRangeHigh?: string;
  taxAssessedValue?: string;
  annualTaxAmount?: string;
  daysOnMarket?: number;
  dateOnMarket?: string;

  // ── Climate ──
  floodZone?: string;
  floodZoneDescription?: string;
  fireRisk?: string;
  windRisk?: string;
  airQualityRisk?: string;

  // ── Getting Around ──
  walkScore?: number;
  walkScoreDescription?: string;
  bikeScore?: number;
  bikeScoreDescription?: string;
  transitScore?: number;
  transitScoreDescription?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractZpid(url: string): string {
  const match = url.match(/\/(\d+)_zpid/);
  if (!match) throw new Error("Invalid Zillow URL — no ZPID found");
  return match[1];
}

/** Read a <meta> tag value, handles both attribute orders */
function getMeta(html: string, selector: string): string {
  const re1 = new RegExp(`<meta[^>]+${selector}[^>]+content="([^"]+)"`, "i");
  const re2 = new RegExp(`<meta[^>]+content="([^"]+)"[^>]+${selector}`, "i");
  return ((html.match(re1) || html.match(re2))?.[1] ?? "").trim();
}

/** Find the FIRST value for a given key anywhere in the object tree */
function findValue(obj: any, key: string, depth = 0): any {
  if (depth > 15 || obj == null) return undefined;
  if (typeof obj !== "object") return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = findValue(item, key, depth + 1);
      if (r !== undefined) return r;
    }
    return undefined;
  }
  if (key in obj) return obj[key];
  for (const k of Object.keys(obj)) {
    const r = findValue(obj[k], key, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

/** Normalize any value to a string array */
function toArr(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse Zillow's HTML __NEXT_DATA__ and return the Apollo cache object */
function parseNextData(html: string): any {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const nextData = JSON.parse(m[1]);

    // Zillow 2024+ stores gdpClientCache inside componentProps, not pageProps directly
    const compGdp = nextData?.props?.pageProps?.componentProps?.gdpClientCache;
    if (compGdp) {
      try {
        const parsed = typeof compGdp === "string" ? JSON.parse(compGdp) : compGdp;
        if (parsed && typeof parsed === "object") return parsed;
      } catch { /* fall through */ }
    }

    // Older Zillow structure: gdpClientCache directly on pageProps
    const gdp = nextData?.props?.pageProps?.gdpClientCache;
    if (gdp) {
      try {
        const parsed = typeof gdp === "string" ? JSON.parse(gdp) : gdp;
        if (parsed && typeof parsed === "object") return parsed;
      } catch { /* fall through */ }
    }

    return nextData?.props ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta-tag extraction (always available — basic fields)
// ─────────────────────────────────────────────────────────────────────────────

function extractMeta(html: string) {
  const ogTitle = getMeta(html, 'property="og:title"') || getMeta(html, 'name="og:title"');
  const desc = getMeta(html, 'name="description"') || getMeta(html, 'property="og:description"');

  const location = ogTitle.split("|")[0].split(" - ")[0].trim();
  const street = location.split(",")[0].trim();

  const priceM = desc.match(/\$\s*([\d,]+)/);
  const price = priceM ? Number(priceM[1].replace(/,/g, "")) : 0;

  const bedsM = desc.match(/(\d+)\s*bed/i);
  const bathsM = desc.match(/([\d.]+)\s*bath/i);
  const sqftM = desc.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft|square\s*feet)/i);
  const yearM = desc.match(/built\s+(?:in\s+)?(\d{4})/i);
  const typeM = desc.match(/\b(single[\s-]family|condo(?:minium)?|townhouse|multi[\s-]family|manufactured|land|lot)\b/i);

  return {
    title: street || location,
    location,
    price,
    description: desc,
    beds: bedsM ? Number(bedsM[1]) : undefined,
    baths: bathsM ? Number(bathsM[1]) : undefined,
    sqft: sqftM ? Number(sqftM[1].replace(/,/g, "")) : undefined,
    yearBuilt: yearM ? Number(yearM[1]) : undefined,
    homeType: typeM ? typeM[1] : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD extraction (structured SEO data — sometimes present)
// ─────────────────────────────────────────────────────────────────────────────

function extractJsonLd(html: string): Partial<ZillowPropertyData> {
  const blocks = [
    ...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const m of blocks) {
    try {
      const ld = JSON.parse(m[1]);
      if (!ld.address?.streetAddress) continue;
      const a = ld.address;
      return {
        title: a.streetAddress,
        location: [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode]
          .filter(Boolean)
          .join(", "),
        price: ld.offers?.price ? Number(String(ld.offers.price).replace(/\D/g, "")) : undefined,
        description: ld.description || undefined,
        yearBuilt: ld.yearBuilt ? Number(ld.yearBuilt) : undefined,
        homeType: ld["@type"] || undefined,
      };
    } catch {
      /* skip malformed */
    }
  }
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// __NEXT_DATA__ detailed field extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractDetailedFields(cache: any): Partial<ZillowPropertyData> {
  if (!cache) return {};

  const result: Partial<ZillowPropertyData> = {};

  // ── resoFacts: detailed property info from Zillow's Apollo cache ──
  const rf = findValue(cache, "resoFacts");
  if (rf) {
    // Basic (Zillow uses bathroomsFull/bathroomsHalf, not fullBathrooms)
    if (rf.bedrooms != null)      result.beds = Number(rf.bedrooms);
    if (rf.bathrooms != null)     result.baths = Number(rf.bathrooms);
    if (rf.bathroomsFull != null) result.fullBathrooms = Number(rf.bathroomsFull);
    if (rf.livingArea != null)    result.sqft = Number(rf.livingArea);
    if (rf.yearBuilt != null)     result.yearBuilt = Number(rf.yearBuilt);
    if (rf.homeType)              result.homeType = rf.homeType;
    if (rf.propertySubType)       result.propertySubtype = Array.isArray(rf.propertySubType)
                                    ? rf.propertySubType[0] : rf.propertySubType;
    if (rf.architecturalStyle)    result.propertySubtype = rf.architecturalStyle;
    if (rf.storiesTotal != null || rf.stories != null)
      result.stories = Number(rf.storiesTotal ?? rf.stories);
    if (rf.levels) result.levels = rf.levels;

    // Lot — use string lotSize ("1.20 Acres") not the raw sq ft number
    if (rf.lotSize && typeof rf.lotSize === "string") result.lotFeatures = [rf.lotSize];
    else if (rf.lotFeatures) result.lotFeatures = toArr(rf.lotFeatures);
    if (rf.parcelNumber) result.parcelNumber = rf.parcelNumber;

    // Interior
    if (rf.heating)           result.heating = toArr(rf.heating);
    if (rf.cooling)           result.cooling = toArr(rf.cooling);
    if (rf.appliances)        result.appliancesIncluded = toArr(rf.appliances);
    if (rf.laundry)           result.laundry = toArr(rf.laundry);
    if (rf.interiorFeatures)  result.interiorFeatures = toArr(rf.interiorFeatures);
    if (rf.flooring)          result.flooring = toArr(rf.flooring);
    if (rf.basement)          result.basement = rf.basement;
    if (rf.fireplaces != null) result.fireplaceCount = Number(rf.fireplaces);
    if (rf.fireplaceFeatures) result.fireplaceFeatures = toArr(rf.fireplaceFeatures);
    if (rf.livingAreaRange)   result.totalLivableArea = String(rf.livingAreaRange);

    // Exterior & Parking
    if (rf.patioAndPorchFeatures) result.patioAndPorch = toArr(rf.patioAndPorchFeatures);
    if (rf.exteriorFeatures)      result.exteriorFeatures = toArr(rf.exteriorFeatures);
    if (rf.fencing)               result.fencing = toArr(rf.fencing);
    if (rf.poolFeatures)          result.poolFeatures = toArr(rf.poolFeatures);
    if (rf.spaYN != null)         result.hasSpa = rf.spaYN === true || rf.spaYN === "true";
    if (rf.spaFeatures)           result.spaFeatures = toArr(rf.spaFeatures);

    // Construction
    if (rf.constructionMaterials) result.constructionMaterials = toArr(rf.constructionMaterials);
    if (rf.foundationDetails)     result.foundation = toArr(rf.foundationDetails);
    if (rf.roofType)              result.roof = toArr(rf.roofType);

    // Utilities
    if (rf.sewer)     result.sewer = toArr(rf.sewer);
    if (rf.water)     result.water = toArr(rf.water);
    if (rf.utilities) result.utilitiesForProperty = toArr(rf.utilities);

    // Community & HOA
    if (rf.communityFeatures) result.communityFeatures = toArr(rf.communityFeatures);
    if (rf.associationFee != null || rf.hoaFee != null)
      result.hoaFee = String(rf.associationFee ?? rf.hoaFee);
    if (rf.hasAssociation != null)
      result.hasHOA = rf.hasAssociation === true || rf.hasAssociation === "true";
    if (rf.subdivisionName) result.subdivision = rf.subdivisionName;

    // Financial / Listing
    if (rf.pricePerSquareFoot != null) result.pricePerSqft = String(rf.pricePerSquareFoot);
    if (rf.taxAssessedValue != null)   result.taxAssessedValue = String(rf.taxAssessedValue);
    if (rf.taxAnnualAmount != null)    result.annualTaxAmount = String(rf.taxAnnualAmount);
    if (rf.daysOnZillow != null)       result.daysOnMarket = Number(rf.daysOnZillow);

    // ── Build factsAndFeatures from all non-null resoFacts fields ──
    // Anything not explicitly mapped above goes here for display
    const SKIP_KEYS = new Set(["bedrooms","bathrooms","bathroomsFull","bathroomsThreeQuarter",
      "bathroomsHalf","bathroomsOneQuarter","homeType","lotSize","pricePerSquareFoot",
      "yearBuilt","propertySubType","architecturalStyle"]);
    const factsSection: Record<string, string> = {};
    for (const [k, v] of Object.entries(rf)) {
      if (SKIP_KEYS.has(k)) continue;
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      const label = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
      factsSection[label] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    if (Object.keys(factsSection).length > 0) {
      result.factsAndFeatures = { "Property Details": factsSection };
    }
  }

  // ── property object (Zillow 2024+: top-level fields on property, not in resoFacts) ──
  const prop = findValue(cache, "property");
  if (prop && typeof prop === "object" && prop.zpid) {
    if (prop.yearBuilt != null && !result.yearBuilt) result.yearBuilt = Number(prop.yearBuilt);
    if (prop.bedrooms != null && !result.beds) result.beds = Number(prop.bedrooms);
    if (prop.bathroomsFull != null && !result.fullBathrooms) result.fullBathrooms = Number(prop.bathroomsFull);
    if (!result.baths && prop.bathroomsFull != null)
      result.baths = Number(prop.bathroomsFull) + (prop.bathroomsHalf ? 0.5 : 0);
    if (prop.homeType && !result.homeType) result.homeType = prop.homeType;
    if (prop.propertySubType?.[0] && !result.propertySubtype) result.propertySubtype = prop.propertySubType[0];
    if (prop.pricePerSquareFoot != null && !result.pricePerSqft) result.pricePerSqft = String(prop.pricePerSquareFoot);
    // prop.lotSize is the raw sq ft number; prefer the string version from resoFacts (set above)
    if (prop.lotAreaValue != null && prop.lotAreaUnits && !result.lotFeatures)
      result.lotFeatures = [`${prop.lotAreaValue} ${prop.lotAreaUnits}`];
    if (prop.description && !result.description) result.description = prop.description;
    if (prop.daysOnZillow != null && !result.daysOnMarket) result.daysOnMarket = Number(prop.daysOnZillow);
    if (prop.datePostedString && !result.dateOnMarket) result.dateOnMarket = prop.datePostedString;
    if (prop.taxAssessedValue != null && !result.taxAssessedValue) result.taxAssessedValue = String(prop.taxAssessedValue);
    if (prop.annualHomeownersInsurance != null) void 0; // skip
    if (prop.hasGarage != null) {
      // store garage info as a highlight fact
      const garageStr = prop.hasGarage ? `Garage (${prop.garageParkingCapacity ?? 0} cars)` : "No garage";
      if (!result.exteriorFeatures) result.exteriorFeatures = [];
      result.exteriorFeatures = [...result.exteriorFeatures, garageStr];
    }
  }

  // ── Market value ──
  const zest = findValue(cache, "zestimate");
  if (zest != null) result.zestimate = String(zest);

  const rentZest = findValue(cache, "rentZestimate");
  if (rentZest != null) result.rentZestimate = String(rentZest);

  const zLow = findValue(cache, "lowEstimate") ?? findValue(cache, "estimatedSalesRangeLow");
  if (zLow != null) result.estimatedSalesRangeLow = String(zLow);

  const zHigh = findValue(cache, "highEstimate") ?? findValue(cache, "estimatedSalesRangeHigh");
  if (zHigh != null) result.estimatedSalesRangeHigh = String(zHigh);

  // ── Getting around (scores) ──
  const ws = findValue(cache, "walkScore");
  if (ws != null) result.walkScore = Number(ws);
  const wsd = findValue(cache, "walkScoreWithDescription");
  if (wsd?.description) result.walkScoreDescription = wsd.description;

  const bs = findValue(cache, "bikeScore");
  if (bs != null) result.bikeScore = Number(bs);

  const ts = findValue(cache, "transitScore");
  if (ts != null) result.transitScore = Number(ts);
  const tsd = findValue(cache, "transitScoreWithDescription");
  if (tsd?.description) result.transitScoreDescription = tsd.description;

  // ── Climate / flood / fire / wind ──
  const floodSum = findValue(cache, "floodRiskSummary");
  if (floodSum) {
    result.floodZone = floodSum.floodZone ?? floodSum.factor ?? undefined;
    result.floodZoneDescription = floodSum.description ?? floodSum.text ?? undefined;
  }
  const floodZone = findValue(cache, "floodZone");
  if (floodZone && !result.floodZone) result.floodZone = String(floodZone);

  const fireSum = findValue(cache, "fireRiskSummary") ?? findValue(cache, "wildfireRiskSummary");
  if (fireSum) result.fireRisk = fireSum.risk ?? fireSum.factor ?? fireSum.score ?? undefined;

  const windSum = findValue(cache, "windRiskSummary");
  if (windSum) result.windRisk = windSum.risk ?? windSum.factor ?? windSum.score ?? undefined;

  const aqSum = findValue(cache, "airQualityRiskSummary") ?? findValue(cache, "airQuality");
  if (aqSum) result.airQualityRisk = aqSum.risk ?? aqSum.factor ?? aqSum.score ?? undefined;

  // ── Full description (often richer than meta) ──
  const fullDesc = findValue(cache, "description");
  if (fullDesc && String(fullDesc).length > 50) result.description = String(fullDesc);

  // ── Date on market ──
  const datePosted = findValue(cache, "datePostedString") ?? findValue(cache, "listingDateTimeOnZillow");
  if (datePosted) result.dateOnMarket = String(datePosted);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic facts & features extraction
// Handles h2-h6, <button> headers, <dt>/<dd> pairs, and <li> Label: Value items.
// Falls back to a single "Facts & Features" bucket so nothing is ever lost.
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_SECTIONS = [
  "Interior", "Exterior", "Lot", "Construction", "Utilities",
  "Community and HOA", "Financial and listing details",
  "Getting around", "Climate risks", "Property details",
  "Parking", "Basement", "Other interior features",
];

function looksLikeSectionHeader(text: string): boolean {
  if (text.length < 3 || text.length > 70) return false;
  // Must start with a capital letter and not look like a fact value
  if (!/^[A-Z]/.test(text)) return false;
  // Must NOT contain a colon (that would be a fact, not a header)
  if (text.includes(":")) return false;
  return true;
}

function extractFactsAndFeatures(html: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "Facts & Features"; // default fallback bucket

  // Sentinel pass — mark headings, buttons, dt, dd, li before stripping HTML
  const processed = html
    // h2-h6
    .replace(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi, (_, c) =>
      `\n§HDR§${c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}\n`
    )
    // <button> — Zillow uses these for collapsible section headers
    .replace(/<button[^>]*>([\s\S]*?)<\/button>/gi, (_, c) => {
      const text = c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      return looksLikeSectionHeader(text) ? `\n§HDR§${text}\n` : ` ${text} `;
    })
    // <dt> — definition term (label in dt/dd pairs)
    .replace(/<dt[^>]*>([\s\S]*?)<\/dt>/gi, (_, c) =>
      `\n§DT§${c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}\n`
    )
    // <dd> — definition description (value in dt/dd pairs)
    .replace(/<dd[^>]*>([\s\S]*?)<\/dd>/gi, (_, c) =>
      `\n§DD§${c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}\n`
    )
    // <li> — list items, may be "Label: Value"
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) =>
      `\n§LI§${c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()}\n`
    )
    .replace(/<[^>]+>/g, " ");

  let lastDt = "";

  for (const raw of processed.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("§HDR§")) {
      const header = line.slice(5).trim();
      const matched = KNOWN_SECTIONS.find(
        (s) =>
          header.toLowerCase().includes(s.toLowerCase()) ||
          s.toLowerCase().includes(header.toLowerCase())
      );
      if (matched) {
        currentSection = matched;
        lastDt = "";
      } else if (looksLikeSectionHeader(header)) {
        currentSection = header;
        lastDt = "";
      }

    } else if (line.startsWith("§DT§")) {
      lastDt = line.slice(4).trim();

    } else if (line.startsWith("§DD§")) {
      const value = line.slice(4).trim();
      if (lastDt && value && value.length < 300) {
        if (!result[currentSection]) result[currentSection] = {};
        result[currentSection][lastDt] = value;
        lastDt = "";
      }

    } else if (line.startsWith("§LI§")) {
      const fact = line.slice(4).trim();
      const colonIdx = fact.indexOf(":");
      if (colonIdx > 1 && colonIdx < 80) {
        const label = fact.slice(0, colonIdx).trim();
        const value = fact.slice(colonIdx + 1).trim();
        if (label && value && label.length < 80 && value.length < 300) {
          if (!result[currentSection]) result[currentSection] = {};
          result[currentSection][label] = value;
        }
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendered-page text extraction
// After render=true, Zillow Facts & Features appear as "Label: Value" text.
// ─────────────────────────────────────────────────────────────────────────────

function extractFromRenderedText(html: string): Partial<ZillowPropertyData> {
  const result: Partial<ZillowPropertyData> = {};

  // Strip tags, decode common entities, collapse whitespace
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

  /** Find text after "Label:" and return it trimmed (up to 300 chars, stops at next line-like boundary) */
  const find = (re: RegExp): string | undefined =>
    text.match(re)?.[1]?.replace(/\s+/g, " ").trim().slice(0, 300);

  /** Split result into an array on comma / bullet / pipe */
  const arr = (s: string | undefined): string[] | undefined =>
    s ? s.split(/[,•·|]/).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 120) : undefined;

  const num = (re: RegExp): number | undefined => {
    const m = text.match(re);
    if (!m) return undefined;
    const n = parseFloat(m[1].replace(/[^0-9.]/g, ""));
    return isNaN(n) ? undefined : n;
  };

  // ── Interior ──
  const heatRaw = find(/Heat(?:ing)?(?:\s*type)?[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Cooling|Appliance|Laundry|Interior|Flooring|$)/i);
  const heat = arr(heatRaw); if (heat?.length) result.heating = heat;

  const coolRaw = find(/Cool(?:ing)?(?:\s*type)?[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Appliance|Laundry|Interior|Flooring|$)/i);
  const cool = arr(coolRaw); if (cool?.length) result.cooling = cool;

  const appRaw = find(/Appliances?(?:\s*included)?[:\s]+([^:]{3,300}?)(?=\s[A-Z][a-z]|Laundry|Interior|Flooring|$)/i);
  const app = arr(appRaw); if (app?.length) result.appliancesIncluded = app;

  const laundryRaw = find(/Laundry[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Interior|Flooring|$)/i);
  const laundry = arr(laundryRaw); if (laundry?.length) result.laundry = laundry;

  const intFeatRaw = find(/Interior\s*features?[:\s]+([^:]{3,300}?)(?=\s[A-Z][a-z]|Flooring|Windows|Basement|Fireplace|$)/i);
  const intFeat = arr(intFeatRaw); if (intFeat?.length) result.interiorFeatures = intFeat;

  const floorRaw = find(/Flooring[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Window|Basement|Fireplace|$)/i);
  const floor = arr(floorRaw); if (floor?.length) result.flooring = floor;

  const basementRaw = find(/Basement[:\s]+([^:]{3,150}?)(?=\s[A-Z][a-z]|Fireplace|$)/i);
  if (basementRaw) result.basement = basementRaw;

  const fireplaceCount = num(/(?:Number of\s*)?Fireplaces?[:\s]+(\d+)/i);
  if (fireplaceCount != null) result.fireplaceCount = fireplaceCount;

  const ffRaw = find(/Fireplace\s*features?[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|$)/i);
  const ff = arr(ffRaw); if (ff?.length) result.fireplaceFeatures = ff;

  const livArea = find(/(?:Total\s*)?(?:Interior\s*)?Livable\s*area[:\s]+([\d,]+\s*(?:sq\.?\s*ft|sqft)?)/i);
  if (livArea) result.totalLivableArea = livArea;

  // ── Exterior ──
  const stories = num(/(?:Number of\s*)?Stori(?:es|ys?)[:\s]+(\d+)/i);
  if (stories != null) result.stories = stories;

  const levels = find(/Levels?[:\s]+([^:]{2,60}?)(?=\s[A-Z][a-z]|$)/i);
  if (levels) result.levels = levels;

  const patioRaw = find(/Patio\s*(?:and|&)?\s*porch[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Exterior|Pool|Spa|Fence|$)/i);
  const patio = arr(patioRaw); if (patio?.length) result.patioAndPorch = patio;

  const extRaw = find(/Exterior\s*features?[:\s]+([^:]{3,300}?)(?=\s[A-Z][a-z]|Pool|Spa|Fence|$)/i);
  const ext = arr(extRaw); if (ext?.length) result.exteriorFeatures = ext;

  const poolRaw = find(/Pool\s*features?[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Spa|Fence|$)/i);
  const pool = arr(poolRaw); if (pool?.length) result.poolFeatures = pool;

  const spaRaw = find(/Spa\s*features?[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Fence|$)/i);
  const spa = arr(spaRaw); if (spa?.length) result.spaFeatures = spa;
  if (text.match(/Has\s*spa[:\s]+Yes/i) || spaRaw) result.hasSpa = true;

  const fenceRaw = find(/Fencing[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|$)/i);
  const fence = arr(fenceRaw); if (fence?.length) result.fencing = fence;

  // ── Lot ──
  const lotRaw = find(/Lot\s*features?[:\s]+([^:]{3,300}?)(?=\s[A-Z][a-z]|Parcel|$)/i);
  const lot = arr(lotRaw); if (lot?.length) result.lotFeatures = lot;

  const parcel = find(/Parcel\s*(?:number|#)?[:\s]+([A-Z0-9\-]{3,40})/i);
  if (parcel) result.parcelNumber = parcel;

  // ── Construction ──
  const homeType = find(/Home\s*type[:\s]+([^:]{2,80}?)(?=\s[A-Z][a-z]|Property\s*sub|$)/i);
  if (homeType) result.homeType = homeType;

  const subtype = find(/Property\s*subtype[:\s]+([^:]{2,80}?)(?=\s[A-Z][a-z]|$)/i);
  if (subtype) result.propertySubtype = subtype;

  const matRaw = find(/Construction\s*materials?[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Foundation|Roof|$)/i);
  const mat = arr(matRaw); if (mat?.length) result.constructionMaterials = mat;

  const foundRaw = find(/Foundation[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Roof|$)/i);
  const found = arr(foundRaw); if (found?.length) result.foundation = found;

  const roofRaw = find(/Roof[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Year|$)/i);
  const roof = arr(roofRaw); if (roof?.length) result.roof = roof;

  const yearBuilt = num(/Year\s*built[:\s]+(\d{4})/i);
  if (yearBuilt) result.yearBuilt = yearBuilt;

  // ── Utilities ──
  const sewerRaw = find(/Sewer[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Water|Utilities|$)/i);
  const sewer = arr(sewerRaw); if (sewer?.length) result.sewer = sewer;

  const waterRaw = find(/Water[:\s]+([^:]{3,200}?)(?=\s[A-Z][a-z]|Utilities|$)/i);
  const water = arr(waterRaw); if (water?.length) result.water = water;

  const utilRaw = find(/Utilities?\s*(?:for\s*property)?[:\s]+([^:]{3,300}?)(?=\s[A-Z][a-z]|$)/i);
  const util = arr(utilRaw); if (util?.length) result.utilitiesForProperty = util;

  // ── Community & HOA ──
  const commRaw = find(/Community\s*features?[:\s]+([^:]{3,300}?)(?=\s[A-Z][a-z]|Security|HOA|Subdivision|$)/i);
  const comm = arr(commRaw); if (comm?.length) result.communityFeatures = comm;

  const hoaFee = find(/HOA\s*(?:fee|dues?)[:\s]+\$?([\d,]+(?:\.\d+)?)/i);
  if (hoaFee) { result.hoaFee = hoaFee; result.hasHOA = true; }
  if (text.match(/Has\s*HOA[:\s]+Yes/i)) result.hasHOA = true;

  const subdivision = find(/Subdivision[:\s]+([^:]{2,100}?)(?=\s[A-Z][a-z]|$)/i);
  if (subdivision) result.subdivision = subdivision;

  // ── Financial / Listing ──
  const ppsf = find(/Price\s*per\s*sq(?:uare)?\s*(?:ft|feet)[:\s]+\$?([\d,]+)/i);
  if (ppsf) result.pricePerSqft = ppsf;

  const taxVal = find(/Tax\s*assessed\s*value[:\s]+\$?([\d,]+)/i);
  if (taxVal) result.taxAssessedValue = taxVal;

  const taxAmt = find(/Annual\s*tax\s*amount[:\s]+\$?([\d,]+)/i);
  if (taxAmt) result.annualTaxAmount = taxAmt;

  const days = num(/(\d+)\s*days?\s*on\s*(?:zillow|market)/i);
  if (days != null) result.daysOnMarket = days;

  // ── Market Value ──
  const zest = find(/Zestimate[®]?[:\s]+\$?([\d,]+)/i);
  if (zest) result.zestimate = zest;

  const rentZest = find(/Rent\s*Zestimate[®]?[:\s]+\$?([\d,]+)/i);
  if (rentZest) result.rentZestimate = rentZest;

  // ── Climate ──
  const floodZone = find(/Flood\s*(?:zone|factor|risk)[:\s]+([^:]{2,100}?)(?=\s[A-Z][a-z]|Fire|Wind|$)/i);
  if (floodZone) result.floodZone = floodZone;

  const fireRisk = find(/(?:Fire|Wildfire)\s*(?:risk|factor)[:\s]+([^:]{2,60}?)(?=\s[A-Z][a-z]|Wind|Air|$)/i);
  if (fireRisk) result.fireRisk = fireRisk;

  const windRisk = find(/Wind\s*(?:risk|factor)[:\s]+([^:]{2,60}?)(?=\s[A-Z][a-z]|Air|$)/i);
  if (windRisk) result.windRisk = windRisk;

  const aq = find(/Air\s*quality[:\s]+([^:]{2,60}?)(?=\s[A-Z][a-z]|$)/i);
  if (aq) result.airQualityRisk = aq;

  // ── Getting Around ──
  const ws = num(/Walk\s*score[:\s]+(\d+)/i);
  if (ws != null) result.walkScore = ws;

  const bs = num(/Bike\s*(?:transit\s*)?score[:\s]+(\d+)/i);
  if (bs != null) result.bikeScore = bs;

  const ts = num(/Transit\s*score[:\s]+(\d+)/i);
  if (ts != null) result.transitScore = ts;

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchZillowProperty(url: string): Promise<ZillowPropertyData> {
  const zpid = extractZpid(url);

  let html: string;
  try {
    // Route through ScraperAPI when key is set — bypasses Zillow's bot detection.
    // Without it, Zillow blocks requests from server/cloud IPs (403/429).
    // render=true → ScraperAPI uses a real headless browser, which gets the
    // JS-rendered Facts & Features section that Zillow loads after page load.
    const fetchUrl = env.SCRAPER_API_KEY
      ? `http://api.scraperapi.com?api_key=${env.SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&render=true&country_code=us`
      : url;

    console.log("[Zillow] Fetching via", env.SCRAPER_API_KEY ? "ScraperAPI (render=true)" : "direct", "...");
    const res = await axios.get(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 70000,   // 70 s — render=true can take 40-60 s
      decompress: true,
    });
    html = res.data as string;
    console.log("[Zillow] HTML received, length:", html.length);
  } catch (err: any) {
    if (err.response?.status === 403 || err.response?.status === 429) {
      throw new Error(
        env.SCRAPER_API_KEY
          ? "ScraperAPI was blocked by Zillow. Try again in a moment."
          : "Zillow blocked the request. Add SCRAPER_API_KEY to your .env to bypass bot detection."
      );
    }
    throw new Error(`Failed to fetch Zillow page: ${err.message}`);
  }

  // Layer 1: meta tags — always present
  const meta = extractMeta(html);

  // Layer 2: JSON-LD — present for SEO
  const ld = extractJsonLd(html);

  // Layer 3: __NEXT_DATA__ Apollo cache — detailed fields when present
  const cache = parseNextData(html);
  const detailed = extractDetailedFields(cache);

  // Layer 4: rendered DOM text — Facts & Features from JS-rendered page (render=true)
  const rendered = extractFromRenderedText(html);

  // Layer 5: dynamic facts — ALL label:value pairs grouped by section
  const factsAndFeatures = extractFactsAndFeatures(html);

  // Merge: meta → JSON-LD → __NEXT_DATA__ → rendered text (later wins)
  const merged: ZillowPropertyData = {
    // Base from meta (always available)
    title:       meta.title       || "",
    location:    meta.location    || "",
    price:       meta.price       || 0,
    description: meta.description || "",
    beds:        meta.beds,
    baths:       meta.baths,
    sqft:        meta.sqft,
    yearBuilt:   meta.yearBuilt,
    homeType:    meta.homeType,

    // JSON-LD overrides
    ...ld,

    // __NEXT_DATA__ overrides
    ...detailed,

    // Rendered text fills in everything else (Facts & Features section)
    ...rendered,

    // Always keep zpid/url/images
    zpid,
    zillowUrl: url,
    images: [],              // admin adds manually
    highlights: [],          // computed below
    // Merge resoFacts-derived sections with HTML-parsed sections
    factsAndFeatures: { ...(detailed.factsAndFeatures ?? {}), ...factsAndFeatures },
  };

  if (!merged.location?.trim() && !merged.title?.trim()) {
    throw new Error(
      "Could not extract property data from this Zillow page. " +
      "The URL may be invalid, or Zillow may be blocking the request."
    );
  }

  // Build highlights from what was extracted
  const h: string[] = [];
  if (merged.beds)        h.push(`${merged.beds} Bedroom${merged.beds !== 1 ? "s" : ""}`);
  if (merged.baths)       h.push(`${merged.baths} Bathroom${merged.baths !== 1 ? "s" : ""}`);
  if (merged.sqft)        h.push(`${Number(merged.sqft).toLocaleString()} sq ft`);
  if (merged.yearBuilt)   h.push(`Built in ${merged.yearBuilt}`);
  if (merged.homeType)    h.push(`Type: ${merged.homeType}`);
  if (merged.stories)     h.push(`${merged.stories} Stories`);
  if (merged.hasHOA && merged.hoaFee) h.push(`HOA: $${merged.hoaFee}/mo`);
  if (merged.walkScore)   h.push(`Walk Score: ${merged.walkScore}`);
  if (merged.floodZone)   h.push(`Flood Zone: ${merged.floodZone}`);
  merged.highlights = h;

  const resoFacts = cache ? findValue(cache, "resoFacts") : null;

  merged._debug = {
    hasResoFacts: !!resoFacts,
    resoFactsKeys: resoFacts ? Object.keys(resoFacts) : [],
    resoFactsSample: resoFacts ? JSON.stringify(resoFacts).slice(0, 2000) : "NOT FOUND",
    factSectionCount: Object.keys(factsAndFeatures).length,
  } as any;

  return merged;
}
