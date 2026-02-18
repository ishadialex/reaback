/**
 * Parse a User-Agent string into device type and browser name.
 * Handles iOS browser variants that use different identifiers than their desktop counterparts:
 * CriOS = Chrome on iOS, FxiOS = Firefox on iOS, EdgiOS = Edge on iOS, OPiOS = Opera on iOS
 */
export function parseUserAgent(ua: string | undefined): { device: string; browser: string } {
  if (!ua) return { device: "Unknown", browser: "Unknown" };

  let browser = "Unknown";
  if (ua.includes("FxiOS") || ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("EdgiOS") || ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("OPiOS") || ua.includes("OPR")) browser = "Opera";
  else if (ua.includes("Brave")) browser = "Brave";
  else if (ua.includes("CriOS") || ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  let device = "Desktop";
  if (ua.includes("iPad") || ua.includes("Tablet")) device = "Tablet";
  else if (ua.includes("Mobile")) device = "Mobile";

  return { device, browser };
}
