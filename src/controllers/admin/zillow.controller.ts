import { Request, Response } from "express";
import { fetchZillowProperty } from "../../services/zillow.service.js";
import { success, error } from "../../utils/response.js";

/**
 * POST /api/admin/zillow/import
 * Body: { url: "https://www.zillow.com/homedetails/..." }
 *
 * Returns pre-filled property data mapped to the Add Property form fields.
 * Does NOT save to DB — admin reviews and submits via the normal create endpoint.
 */
export async function importFromZillow(req: Request, res: Response) {
  const { url } = req.body as { url?: string };

  if (!url || typeof url !== "string") {
    return error(res, "url is required", 400);
  }

  if (!url.includes("zillow.com")) {
    return error(res, "URL must be a Zillow property page", 400);
  }

  if (!url.includes("_zpid")) {
    return error(
      res,
      "URL must be a Zillow property detail page (must contain a ZPID)",
      400
    );
  }

  console.log("[Zillow] Request received for URL:", url);
  try {
    console.log("[Zillow] Calling fetchZillowProperty...");
    const data = await fetchZillowProperty(url);
    console.log("[Zillow] Done. Keys:", Object.keys(data));
    return success(res, data, "Property data fetched from Zillow");
  } catch (err: any) {
    console.error("[Zillow import error]", err.message);
    return error(res, err.message || "Failed to fetch Zillow property", 502);
  }
}
