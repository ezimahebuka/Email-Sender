import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import {
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_RECIPIENTS,
  parseRecipients,
  validateAttachmentMetadata,
  validateMessage,
  validateRecipients,
  validateSubject,
} from "@/lib/email-validation";
import { processRecipients } from "@/lib/process-recipients";
import { validateEmailContent } from "@/lib/email-content";
import {
  classifySmtpError,
  SMTP_AUTH_ERROR,
  SMTP_DELIVERY_ERROR,
  SMTP_RATE_ERROR,
} from "@/lib/smtp-errors";

export const runtime = "nodejs";
export const maxDuration = 300;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.BREVO_SMTP_HOST &&
    process.env.BREVO_SMTP_USER &&
    process.env.BREVO_SMTP_KEY &&
    process.env.BREVO_SENDER_EMAIL,
  );
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          "Brevo SMTP is not configured. Add the required server environment variables.",
      },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const subject = String(form.get("subject") ?? "");
    const submittedHtml = String(form.get("messageHtml") ?? form.get("message") ?? "");
    const maximumRecipients = positiveInteger(
      process.env.MAX_RECIPIENTS,
      DEFAULT_MAX_RECIPIENTS,
    );
    const maximumFiles = positiveInteger(
      process.env.MAX_ATTACHMENT_FILES,
      DEFAULT_MAX_FILES,
    );
    const maxFileBytes =
      positiveInteger(process.env.MAX_ATTACHMENT_SIZE_MB, 10) * 1024 * 1024;
    const maxTotalBytes =
      positiveInteger(process.env.MAX_TOTAL_ATTACHMENT_SIZE_MB, 20) *
      1024 *
      1024;

    validateSubject(subject);
    if (/[\r\n]/.test(subject))
      throw new Error("Subject cannot contain line breaks.");
    const { html, text: message } = validateEmailContent(submittedHtml);
    validateMessage(message);

    const recipientsValue = String(form.get("recipients") ?? "");
    const recipients = validateRecipients(
      parseRecipients(recipientsValue),
      maximumRecipients,
    );
    const files = form
      .getAll("attachments")
      .filter((entry): entry is File => entry instanceof File);
    validateAttachmentMetadata(files, {
      maxFiles: maximumFiles,
      maxFileBytes,
      maxTotalBytes,
    });

    const attachments = await Promise.all(
      files.map(async (file) => ({
        filename: file.name.replace(/[\\/\r\n]/g, "_").slice(0, 180),
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || "application/octet-stream",
      })),
    );

    const port = positiveInteger(process.env.BREVO_SMTP_PORT, 587);
    const transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
      pool: true,
      maxConnections: positiveInteger(process.env.SEND_CONCURRENCY, 3),
      rateDelta: 1000,
      rateLimit: positiveInteger(process.env.SEND_RATE_PER_SECOND, 5),
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
    });

    const senderName = process.env.BREVO_SENDER_NAME?.trim();
    const from = senderName
      ? {
          name: senderName.replace(/[\r\n]/g, " "),
          address: process.env.BREVO_SENDER_EMAIL!,
        }
      : process.env.BREVO_SENDER_EMAIL!;
    const emailHtml = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#202a29">${html}</div>`;
    const concurrency = positiveInteger(process.env.SEND_CONCURRENCY, 3);

    const outcomes = await processRecipients(
      recipients,
      async (email) => {
        try {
          await transporter.sendMail({
            from,
            to: email,
            subject,
            text: message,
            html: emailHtml,
            attachments,
          });
        } catch (error) {
          throw Object.assign(new Error("Delivery failed."), {
            publicError: classifySmtpError(error),
          });
        }
      },
      concurrency,
    );

    transporter.close();
    const failed = outcomes.filter((outcome) => !outcome.success);
    const authFailure = failed.some(
      (outcome) => outcome.error === SMTP_AUTH_ERROR,
    );
    const rateLimited = failed.some(
      (outcome) => outcome.error === SMTP_RATE_ERROR,
    );
    const error = authFailure
      ? "SMTP authentication failed. Check the Brevo SMTP login and key."
      : rateLimited
        ? "Brevo is temporarily rate-limiting delivery. Try again later."
        : failed.length > 0
          ? SMTP_DELIVERY_ERROR
          : undefined;

    return NextResponse.json({
      sent: outcomes.filter((outcome) => outcome.success).length,
      failed: failed.length,
      error,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The request could not be processed.";
    const validationError = [
      "Add at least one recipient",
      "Recipient limit",
      "Invalid email address",
      "Enter an email",
      "Subject must",
      "Message must",
      "Subject cannot",
      "Attach no more",
      "Attachments must",
      "is empty",
      "per-file limit",
      "unsupported file type",
      "Email buttons must use",
      "Email HTML is too large",
    ].some((part) => message.includes(part));

    return NextResponse.json(
      {
        error: validationError
          ? message
          : "The email request could not be processed. Check the attachments and try again.",
      },
      { status: validationError ? 400 : 500 },
    );
  }
}
