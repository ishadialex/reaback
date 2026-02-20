import { emailConfig } from "../config/email.js";
import { env } from "../config/env.js";

const BRAND_PRIMARY = "#4a6cf7";
const BRAND_DARK = "#3b5de7";
const BRAND_LIGHT = "#eef0ff";
const HEADER_BG = "#171c28";

// Logo must be served from the frontend (Vercel), not the backend (Render).
// emailConfig.appUrl points to the API server which does not serve static files.
const logoUrl = `${env.FRONTEND_URL}/images/logo/A-Logo.png`;
const year = new Date().getFullYear();

/**
 * Wrap email body content in a consistent corporate template.
 * Uses table-based layout for maximum email client compatibility.
 */
export function emailWrapper(options: {
  body: string;
  preheader?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${emailConfig.appName}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f0f2f5; }
    /* iOS blue link fix */
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    /* Mobile */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .fluid { max-width: 100% !important; height: auto !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; }
      .stack-column-center { text-align: center !important; }
      .center-on-narrow { text-align: center !important; display: block !important; margin-left: auto !important; margin-right: auto !important; float: none !important; }
      table.center-on-narrow { display: inline-block !important; }
      .padding-mobile { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${options.preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${options.preheader}</div>` : ""}

  <!-- Outer wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0f2f5;">
    <tr>
      <td align="center" style="padding: 30px 10px;">

        <!-- Email container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

          <!-- Logo header -->
          <tr>
            <td style="background-color:#171c28; padding: 28px 40px; text-align:center; border-radius:12px 12px 0 0;" class="padding-mobile">
              <img src="${logoUrl}" alt="${emailConfig.appName}" width="150" style="display:block; margin:0 auto; max-width:150px; height:auto;">
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding: 36px 40px;" class="padding-mobile">
              ${options.body}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;" class="padding-mobile">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr><td style="border-top: 1px solid #eef0f4; font-size:1px; line-height:1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align:center;" class="padding-mobile">
              <p style="margin:0 0 8px; font-size:13px; color:#9ca3af;">&copy; ${year} ${emailConfig.appName}. All rights reserved.</p>
              <p style="margin:0 0 8px; font-size:13px; color:#9ca3af;">This is an automated message. Please do not reply directly.</p>
              <p style="margin:0; font-size:13px;">
                <a href="${emailConfig.appUrl}" style="color:${BRAND_PRIMARY}; text-decoration:none;">Website</a>
                <span style="color:#d1d5db; margin:0 8px;">|</span>
                <a href="mailto:support@alvarado.com" style="color:${BRAND_PRIMARY}; text-decoration:none;">Support</a>
                <span style="color:#d1d5db; margin:0 8px;">|</span>
                <a href="${emailConfig.appUrl}/dashboard/settings?tab=notifications" style="color:${BRAND_PRIMARY}; text-decoration:none;">Preferences</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- End email container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate a primary CTA button (table-based for email clients)
 */
export function ctaButton(text: string, href: string, color: string = HEADER_BG): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 28px 0;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="background:${color}; border-radius:8px;">
            <a href="${href}" target="_blank" style="display:inline-block; padding:14px 36px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">${text}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Generate a highlighted info/alert box
 */
export function infoBox(content: string, _borderColor: string = BRAND_PRIMARY, bgColor: string = BRAND_LIGHT): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td style="background:${bgColor}; border-radius:6px; padding:16px 20px;">
      ${content}
    </td>
  </tr>
</table>`;
}

/**
 * Generate a data row for detail tables
 */
export function detailRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:10px 0; border-bottom:1px solid #f3f4f6; font-size:14px; color:#6b7280; width:140px; vertical-align:top;">${label}</td>
  <td style="padding:10px 0; border-bottom:1px solid #f3f4f6; font-size:14px; color:#1f2937; font-weight:500;">${value}</td>
</tr>`;
}

/**
 * Wrap detail rows in a table
 */
export function detailTable(rows: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
  ${rows}
</table>`;
}

/**
 * Section heading
 */
export function sectionHeading(text: string, color: string = "#1f2937"): string {
  return `<h2 style="margin:0 0 16px; font-size:22px; font-weight:700; color:${color}; line-height:1.3;">${text}</h2>`;
}

/**
 * Paragraph text
 */
export function paragraph(text: string, color: string = "#4b5563"): string {
  return `<p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:${color};">${text}</p>`;
}

/**
 * Big number / amount display
 */
export function bigAmount(amount: string, color: string = BRAND_PRIMARY): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
  <tr>
    <td align="center" style="padding:24px; background:#f9fafb; border-radius:10px;">
      <span style="font-size:36px; font-weight:700; color:${color}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${amount}</span>
    </td>
  </tr>
</table>`;
}

/**
 * OTP code display box
 */
export function otpBox(code: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0;">
  <tr>
    <td align="center" style="padding:28px; background:#f9fafb; border:2px dashed ${BRAND_PRIMARY}; border-radius:10px;">
      <div style="font-size:36px; font-weight:700; letter-spacing:10px; color:${BRAND_PRIMARY}; font-family:'Courier New',monospace;">${code}</div>
      <div style="font-size:13px; color:#6b7280; margin-top:10px;">Your Verification Code</div>
    </td>
  </tr>
</table>`;
}

/**
 * Warning/caution box
 */
export function warningBox(content: string): string {
  return infoBox(content, "#f59e0b", "#fffbeb");
}

/**
 * Success box
 */
export function successBox(content: string): string {
  return infoBox(content, "#22c55e", "#f0fdf4");
}

/**
 * Error/danger box
 */
export function dangerBox(content: string): string {
  return infoBox(content, "#ef4444", "#fef2f2");
}

/**
 * Badge/tag
 */
export function badge(text: string, bgColor: string = BRAND_PRIMARY): string {
  return `<span style="display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:600; color:#ffffff; background:${bgColor}; text-transform:uppercase; letter-spacing:0.5px;">${text}</span>`;
}

export { BRAND_PRIMARY, BRAND_DARK, BRAND_LIGHT };
