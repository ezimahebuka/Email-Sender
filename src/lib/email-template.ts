export type EmailBranding = {
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  footerText?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
};

export type RenderedEmail = { html: string; text: string };

const DEFAULT_BRAND = "Loctus";
const DEFAULT_PRIMARY = "#0B1F44";
const DEFAULT_ACCENT = "#F5B301";

export function extractRecipientName(email: string): string {
  const username = email.slice(0, email.indexOf("@")).trim();
  const words = username
    .split(/[._-]+/u)
    .flatMap((part) => part.match(/\p{L}+/gu) ?? [])
    .filter((part) => part.length > 0);

  if (!words.length) return "";
  return words
    .map((word) => {
      const lower = word.toLocaleLowerCase();
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function safeWebUrl(
  value: string | undefined,
  httpsOnly = false,
): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      httpsOnly
        ? url.protocol === "https:"
        : ["https:", "http:"].includes(url.protocol)
    ) {
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function cleanText(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/[\r\n\t\u0000-\u001f]/g, " ").trim();
  return cleaned || undefined;
}

function configuredColor(value: string | undefined, fallback: string): string {
  return value && /^#[\da-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

export function brandingFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): EmailBranding {
  return {
    brandName: cleanText(environment.EMAIL_BRAND_NAME) ?? DEFAULT_BRAND,
    logoUrl: safeWebUrl(environment.EMAIL_LOGO_URL, true),
    primaryColor: configuredColor(
      environment.EMAIL_PRIMARY_COLOR,
      DEFAULT_PRIMARY,
    ),
    accentColor: configuredColor(
      environment.EMAIL_ACCENT_COLOR,
      DEFAULT_ACCENT,
    ),
    footerText: cleanText(environment.EMAIL_FOOTER_TEXT),
    contactEmail: cleanText(environment.EMAIL_CONTACT_EMAIL),
    contactPhone: cleanText(environment.EMAIL_CONTACT_PHONE),
    websiteUrl: safeWebUrl(environment.EMAIL_WEBSITE_URL, true),
  };
}

export function renderEmailTemplate(
  recipient: string,
  messageHtml: string,
  messageText: string,
  branding: EmailBranding = {},
): RenderedEmail {
  const name = extractRecipientName(recipient);
  const greeting = name ? `Hi ${name},` : "Hello,";
  const brandName = cleanText(branding.brandName) ?? DEFAULT_BRAND;
  const primaryColor = configuredColor(branding.primaryColor, DEFAULT_PRIMARY);
  const accentColor = configuredColor(branding.accentColor, DEFAULT_ACCENT);
  const logoUrl = safeWebUrl(branding.logoUrl, true) ?? "cid:Loctus-mark";
  const websiteUrl = safeWebUrl(branding.websiteUrl, true);
  const contactEmail = cleanText(branding.contactEmail);
  const contactPhone = cleanText(branding.contactPhone);
  const footerText = cleanText(branding.footerText);
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="24" height="24" alt="" style="display:block;width:24px;height:24px;border:0;outline:none;text-decoration:none">`
    : "";

  const footerDetails = [
    contactEmail
      ? `<a href="mailto:${escapeHtml(contactEmail)}" style="color:${primaryColor};text-decoration:underline">${escapeHtml(contactEmail)}</a>`
      : "",
    contactPhone ? escapeHtml(contactPhone) : "",
    websiteUrl
      ? `<a href="${escapeHtml(websiteUrl)}" style="color:${primaryColor};text-decoration:underline">${escapeHtml(websiteUrl.replace(/^https:\/\//, ""))}</a>`
      : "",
  ].filter(Boolean);
  const footerInfo = [
    footerText ? escapeHtml(footerText) : "",
    ...footerDetails,
  ].filter(Boolean);
  const footerHtml = footerInfo.length
    ? `<tr><td style="padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#68758a">${footerInfo.join(' <span style="color:#f5b301">&nbsp;·&nbsp;</span> ')}</td></tr>`
    : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(brandName)}</title></head><body style="margin:0;padding:0;background-color:#ffffff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;background-color:#ffffff"><tr><td align="center" style="padding:12px 16px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff"><tr><td style="padding:10px 0 12px;border-bottom:1px solid ${accentColor}"><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"><tr>${logo ? `<td width="30" valign="middle" style="width:30px;padding-right:8px">${logo}</td>` : ""}<td valign="middle" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.3;font-weight:700;color:${primaryColor}">${escapeHtml(brandName)}</td></tr></table></td></tr><tr><td style="padding:24px 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#27344a"><p style="margin:0 0 16px;font-size:16px;line-height:1.45;font-weight:600;color:${primaryColor}">${escapeHtml(greeting)}</p><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#27344a">${messageHtml}</div><p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:#27344a">Regards,<br><strong style="color:${primaryColor}">${escapeHtml(brandName)}</strong></p></td></tr><tr><td style="padding:10px 0 0;border-top:1px solid #e4e8ee;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#68758a"><strong style="color:${primaryColor}">${escapeHtml(brandName)}</strong>${footerHtml}</td></tr></table></td></tr></table></body></html>`;

  const textFooter = [footerText, contactEmail, contactPhone, websiteUrl]
    .filter(Boolean)
    .join("\n");
  const text = `${greeting}\n\n${messageText.trim()}\n\nRegards,\n${brandName}${textFooter ? `\n\n${textFooter}` : ""}`;

  return { html, text };
}
