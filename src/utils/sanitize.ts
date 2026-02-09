export function sanitizeString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\0/g, "").trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, maxLength);
}

export function validateUrl(value: unknown, maxLength = 2000): string | null {
  const s = sanitizeString(value, maxLength);
  if (!s) return null;
  if (s.startsWith("/") || s.startsWith("https://")) return s;
  return null;
}

export function validateImagePath(value: unknown, maxLength = 1000): string | null {
  const s = sanitizeString(value, maxLength);
  if (!s) return null;
  if (s.startsWith("/images/") || s.startsWith("https://")) return s;
  return null;
}
