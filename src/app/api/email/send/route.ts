import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SendMailOptions } from "nodemailer";
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
  brandingFromEnvironment,
  renderEmailTemplate,
} from "@/lib/email-template";
import {
  classifySmtpError,
  PUBLIC_SMTP_ERRORS,
  SMTP_DELIVERY_ERROR,
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
    const submittedHtml = String(
      form.get("messageHtml") ?? form.get("message") ?? "",
    );
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
      requireTLS: port === 587,
      tls: { minVersion: "TLSv1.2" },
      pool: true,
      maxConnections: positiveInteger(process.env.SEND_CONCURRENCY, 3),
      rateDelta: 1000,
      rateLimit: positiveInteger(process.env.SEND_RATE_PER_SECOND, 5),
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
    });

    const branding = brandingFromEnvironment();
    const senderName = (branding.brandName ?? "Lotus").replace(/[\r\n]/g, " ");
    const senderEmail = process.env.BREVO_SENDER_EMAIL!.trim();
    const configuredReplyTo = process.env.BREVO_REPLY_TO?.trim();
    const replyToEmail =
      configuredReplyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredReplyTo)
        ? configuredReplyTo
        : senderEmail;
    const from = { name: senderName, address: senderEmail };
    const replyTo = { name: senderName, address: replyToEmail };
    const emailAttachments: NonNullable<SendMailOptions["attachments"]> = [
      ...attachments,
    ];
    if (!branding.logoUrl) {
      emailAttachments.push({
        filename: "lotus-mark.png",
        content: await readFile(
          join(process.cwd(), "public", "lotus-mark.png"),
        ),
        contentType: "image/png",
        cid: "lotus-mark",
      });
    }
    const concurrency = positiveInteger(process.env.SEND_CONCURRENCY, 3);

    const outcomes = await processRecipients(
      recipients,
      async (email) => {
        try {
          const renderedEmail = renderEmailTemplate(
            email,
            html,
            message,
            branding,
          );
          const sendInfo = await transporter.sendMail({
            from,
            replyTo,
            to: email,
            subject,
            text: renderedEmail.text,
            html: renderedEmail.html,
            attachments: emailAttachments,
          });
          const responseCode =
            Number(sendInfo.response.match(/^(\d{3})/)?.[1]) || undefined;
          if (sendInfo.rejected.length > 0) {
            const publicError =
              classifySmtpError({ responseCode }) ?? SMTP_DELIVERY_ERROR;
            console.warn(
              "[email-delivery]",
              JSON.stringify({
                event: "recipient_rejected",
                messageId: sendInfo.messageId,
                responseCode,
                rejectedCount: sendInfo.rejected.length,
                category: publicError,
              }),
            );
            throw Object.assign(new Error("Delivery failed."), { publicError });
          }
          console.info(
            "[email-delivery]",
            JSON.stringify({
              event: "smtp_accepted",
              messageId: sendInfo.messageId,
              responseCode,
              acceptedCount: sendInfo.accepted.length,
              attachmentCount: files.length,
            }),
          );
        } catch (error) {
          const suppliedError = (error as { publicError?: unknown })
            ?.publicError;
          const publicError =
            typeof suppliedError === "string" &&
            PUBLIC_SMTP_ERRORS.includes(
              suppliedError as (typeof PUBLIC_SMTP_ERRORS)[number],
            )
              ? suppliedError
              : classifySmtpError(error);
          console.warn(
            "[email-delivery]",
            JSON.stringify({
              event: "send_failed",
              category: publicError ?? SMTP_DELIVERY_ERROR,
            }),
          );
          throw Object.assign(new Error("Delivery failed."), {
            publicError,
          });
        }
      },
      concurrency,
    );

    transporter.close();
    const failed = outcomes.filter((outcome) => !outcome.success);
    const error = failed.length
      ? [
          ...new Set(
            failed.map((outcome) => outcome.error ?? SMTP_DELIVERY_ERROR),
          ),
        ].join(" ")
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
