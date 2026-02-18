import { UAParser } from "ua-parser-js";

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

  // Extract browser name (with iOS-specific handling)
  let browser = "Unknown";
  if (ua.includes("FxiOS")) browser = "Firefox";
  else if (ua.includes("EdgiOS")) browser = "Edge";
  else if (ua.includes("OPiOS")) browser = "Opera";
  else if (ua.includes("CriOS")) browser = "Chrome";
  else if (ua.includes("Brave")) browser = "Brave";
  else if (result.browser.name) {
    browser = result.browser.name;
    // Add version for better tracking
    if (result.browser.version) {
      browser += ` ${result.browser.version.split(".")[0]}`;
    }
  }

  // Extract device type
  let device = "Desktop";
  if (result.device.type === "mobile") device = "Mobile";
  else if (result.device.type === "tablet") device = "Tablet";
  else if (result.device.type === "smarttv") device = "Smart TV";
  else if (result.device.type === "wearable") device = "Wearable";
  else if (result.device.type === "embedded") device = "Embedded";

  // Extract detailed device model
  let deviceModel: string | null = null;
  if (result.device.vendor && result.device.model) {
    deviceModel = `${result.device.vendor} ${result.device.model}`;
  } else if (result.device.model) {
    deviceModel = result.device.model;
  } else if (result.device.vendor) {
    deviceModel = result.device.vendor;
  }

  // Extract OS information
  let os: string | null = null;
  if (result.os.name) {
    os = result.os.name;
  }

  let osVersion: string | null = null;
  if (result.os.version) {
    osVersion = result.os.version;
  }

  return {
    device,
    browser,
    deviceModel,
    os,
    osVersion,
  };
}

/**
 * Format device info into a human-readable string for display
 * Example: "iPhone 15 Pro (iOS 17.2) - Chrome 120"
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
