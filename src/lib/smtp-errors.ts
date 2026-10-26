export const SMTP_AUTH_ERROR =
  "SMTP authentication failed. Check the Brevo SMTP login and key.";
export const SMTP_RATE_ERROR =
  "Brevo is temporarily rate-limiting delivery. Try again later.";
export const SMTP_DELIVERY_ERROR =
  "Delivery failed. Check your Brevo SMTP configuration and sender address.";

export function classifySmtpError(error: unknown): string | undefined {
  const smtpError = error as { code?: string; responseCode?: number };
  if (
    smtpError.responseCode === 535 ||
    smtpError.responseCode === 530 ||
    smtpError.code === "EAUTH"
  ) {
    return SMTP_AUTH_ERROR;
  }
  if ([421, 450, 451, 452].includes(smtpError.responseCode ?? 0)) {
    return SMTP_RATE_ERROR;
  }
  return undefined;
}
