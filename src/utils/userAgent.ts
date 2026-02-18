import { UAParser } from "ua-parser-js";

/**
 * Map Samsung model codes to marketing names.
 * UA strings contain codes like "SM-S928B" instead of "Galaxy S24 Ultra".
 */
const SAMSUNG_MODELS: Record<string, string> = {
  // Galaxy S25 series (2025)
  "SM-S931": "Galaxy S25", "SM-S936": "Galaxy S25+", "SM-S938": "Galaxy S25 Ultra",
  // Galaxy S24 series (2024)
  "SM-S921": "Galaxy S24", "SM-S926": "Galaxy S24+", "SM-S928": "Galaxy S24 Ultra",
  // Galaxy S23 series (2023)
  "SM-S911": "Galaxy S23", "SM-S916": "Galaxy S23+", "SM-S918": "Galaxy S23 Ultra",
  // Galaxy S22 series (2022)
  "SM-S901": "Galaxy S22", "SM-S906": "Galaxy S22+", "SM-S908": "Galaxy S22 Ultra",
  // Galaxy S21 series (2021)
  "SM-G991": "Galaxy S21", "SM-G996": "Galaxy S21+", "SM-G998": "Galaxy S21 Ultra",
  // Galaxy S20 series (2020)
  "SM-G981": "Galaxy S20", "SM-G986": "Galaxy S20+", "SM-G988": "Galaxy S20 Ultra",
  // Galaxy A series (popular mid-range)
  "SM-A556": "Galaxy A55", "SM-A546": "Galaxy A54", "SM-A536": "Galaxy A53",
  "SM-A356": "Galaxy A35", "SM-A346": "Galaxy A34", "SM-A336": "Galaxy A33",
  "SM-A256": "Galaxy A25", "SM-A246": "Galaxy A24", "SM-A156": "Galaxy A15",
  "SM-A146": "Galaxy A14", "SM-A056": "Galaxy A05s",
  // Galaxy Z series (foldables)
  "SM-F956": "Galaxy Z Fold6", "SM-F946": "Galaxy Z Fold5", "SM-F936": "Galaxy Z Fold4",
  "SM-F741": "Galaxy Z Flip6", "SM-F731": "Galaxy Z Flip5", "SM-F721": "Galaxy Z Flip4",
  // Galaxy Note series
  "SM-N986": "Galaxy Note 20 Ultra", "SM-N981": "Galaxy Note 20",
  "SM-N975": "Galaxy Note 10+", "SM-N970": "Galaxy Note 10",
};

/**
 * Map common Xiaomi/Redmi/POCO model codes to marketing names
 */
const XIAOMI_MODELS: Record<string, string> = {
  "2201116SG": "Xiaomi 12", "2203129G": "Xiaomi 12 Pro",
  "2304FPN6DC": "Xiaomi 13", "2210132G": "Xiaomi 13 Pro",
  "23113RKC6G": "Xiaomi 14", "23116PN5BC": "Xiaomi 14 Pro",
  "M2101K6G": "Redmi Note 10 Pro", "22101316G": "Redmi Note 12 Pro",
  "23076RN4BI": "Redmi Note 13 Pro",
  "22011211G": "POCO X4 Pro", "23049PCD8G": "POCO F5",
};

/**
 * Try to resolve a model code to a human-readable name.
 * Samsung codes like "SM-S928B" → match prefix "SM-S928" → "Galaxy S24 Ultra"
 */
function resolveModelName(vendor: string | undefined, modelCode: string): string {
  if (!vendor) return modelCode;

  const v = vendor.toLowerCase();

  if (v === "samsung") {
    // Samsung model codes have a region suffix (e.g., SM-S928B, SM-S928U)
    // Match the first 7 chars (SM-S928) to ignore region variants
    const prefix = modelCode.substring(0, 7);
    if (SAMSUNG_MODELS[prefix]) return SAMSUNG_MODELS[prefix];
    // Also try full code
    if (SAMSUNG_MODELS[modelCode]) return SAMSUNG_MODELS[modelCode];
  }

  if (v === "xiaomi" || v === "redmi" || v === "poco") {
    if (XIAOMI_MODELS[modelCode]) return XIAOMI_MODELS[modelCode];
  }

  // For other vendors, return as-is
  return modelCode;
}

/**
 * Parse a User-Agent string into detailed device and browser information.
 * Returns device model, OS, and browser details for security logging and session tracking.
 */
export function parseUserAgent(ua: string | undefined): {
  device: string;
  browser: string;
  deviceModel: string | null;
  os: string | null;
  osVersion: string | null;
} {
  if (!ua) {
    return {
      device: "Unknown",
      browser: "Unknown",
      deviceModel: null,
      os: null,
      osVersion: null,
    };
  }

  const parser = new UAParser(ua);
  const result = parser.getResult();

  // Extract browser name with version
  let browser = "Unknown";
  // iOS wraps all browsers in WebKit, so we check for in-app browser identifiers first
  if (ua.includes("FxiOS")) browser = "Firefox";
  else if (ua.includes("EdgiOS")) browser = "Edge";
  else if (ua.includes("OPiOS")) browser = "Opera";
  else if (ua.includes("CriOS")) browser = "Chrome";
  else if (ua.includes("Brave")) browser = "Brave";
  else if (result.browser.name) {
    // Clean up "Mobile Chrome" → "Chrome", "Mobile Safari" → "Safari"
    browser = result.browser.name.replace(/^Mobile\s+/, "");
  }

  // Append major version
  if (browser !== "Unknown" && result.browser.version) {
    browser += ` ${result.browser.version.split(".")[0]}`;
  }

  // Extract device type
  let device = "Desktop";
  if (result.device.type === "mobile") device = "Mobile";
  else if (result.device.type === "tablet") device = "Tablet";
  else if (result.device.type === "smarttv") device = "Smart TV";
  else if (result.device.type === "wearable") device = "Wearable";
  else if (result.device.type === "embedded") device = "Embedded";

  // Extract detailed device model with human-readable name resolution
  let deviceModel: string | null = null;
  if (result.device.vendor && result.device.model) {
    const resolvedName = resolveModelName(result.device.vendor, result.device.model);
    // If the resolved name already includes the vendor (e.g., "Xiaomi 14"), don't duplicate
    if (resolvedName.toLowerCase().startsWith(result.device.vendor.toLowerCase())) {
      deviceModel = resolvedName;
    } else {
      deviceModel = `${result.device.vendor} ${resolvedName}`;
    }
  } else if (result.device.model) {
    deviceModel = result.device.model;
  } else if (result.device.vendor) {
    deviceModel = result.device.vendor;
  }

  // For desktops, use OS as a device identifier (e.g., "Windows PC", "Mac")
  if (!deviceModel && device === "Desktop" && result.os.name) {
    if (result.os.name === "Windows") deviceModel = "Windows PC";
    else if (result.os.name === "Mac OS") deviceModel = "Mac";
    else if (result.os.name.includes("Linux")) deviceModel = "Linux PC";
    else if (result.os.name.includes("Chrome")) deviceModel = "Chromebook";
  }

  // Extract OS information
  const os: string | null = result.os.name || null;
  const osVersion: string | null = result.os.version || null;

  return { device, browser, deviceModel, os, osVersion };
}

/**
 * Format device info into a human-readable string for display.
 * Examples:
 *   "Apple iPhone (iOS 17.2) - Chrome 120"
 *   "Samsung Galaxy S24 Ultra (Android 14) - Chrome 120"
 *   "Windows PC (Windows 10) - Chrome 120"
 */
export function formatDeviceInfo(parsed: ReturnType<typeof parseUserAgent>): string {
  const parts: string[] = [];

  // Device model or type
  if (parsed.deviceModel) {
    parts.push(parsed.deviceModel);
  } else {
    parts.push(parsed.device);
  }

  // OS info
  if (parsed.os) {
    let osInfo = parsed.os;
    if (parsed.osVersion) {
      osInfo += ` ${parsed.osVersion}`;
    }
    parts.push(`(${osInfo})`);
  }

  // Browser
  parts.push(parsed.browser);

  return parts.join(" - ");
}
