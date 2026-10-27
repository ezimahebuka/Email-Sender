export const SMTP_AUTH_ERROR =
  "SMTP authentication failed. Check the Brevo SMTP login and key.";
export const SMTP_RATE_ERROR =
  "Brevo is temporarily rate-limiting delivery. Try again later.";
export const SMTP_DELIVERY_ERROR =
  "Delivery failed. Check your Brevo SMTP configuration and sender address.";
export const SMTP_SENDER_ERROR =
  "Brevo rejected the From address. Verify that this sender is authorized in your Brevo account.";
export const SMTP_RECIPIENT_ERROR =
  "Brevo rejected a recipient or message. Check the recipient address and sender authorization.";
export const SMTP_CONNECTION_ERROR =
  "Could not connect securely to Brevo SMTP. Check the host, port, and TLS configuration.";

export const PUBLIC_SMTP_ERRORS = [
  SMTP_AUTH_ERROR,
  SMTP_RATE_ERROR,
  SMTP_DELIVERY_ERROR,
  SMTP_SENDER_ERROR,
  SMTP_RECIPIENT_ERROR,
  SMTP_CONNECTION_ERROR,
];

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
  if ([530, 550, 551, 552].includes(smtpError.responseCode ?? 0)) {
    return SMTP_RECIPIENT_ERROR;
  }
  if ([553].includes(smtpError.responseCode ?? 0)) {
    return SMTP_SENDER_ERROR;
  }
  if ([554].includes(smtpError.responseCode ?? 0)) {
    return SMTP_DELIVERY_ERROR;
  }
  if (
    ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNRESET"].includes(
      smtpError.code ?? "",
    )
  ) {
    return SMTP_CONNECTION_ERROR;
  }
  return SMTP_DELIVERY_ERROR;
}
