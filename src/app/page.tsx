"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import EmailEditor from "@/components/email-editor";
import {
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_RECIPIENTS,
  DEFAULT_MAX_TOTAL_BYTES,
  formatBytes,
  parseRecipients,
  validateAttachmentMetadata,
  validateMessage,
  validateRecipients,
  validateSubject,
} from "@/lib/email-validation";

type SendResult = { sent: number; failed: number; error?: string };

export default function Home() {
  const [subject, setSubject] = useState("");
  const [recipientText, setRecipientText] = useState("");
  const [message, setMessage] = useState("");
  const [messageText, setMessageText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sendingLock = useRef(false);

  const recipients = useMemo(
    () => parseRecipients(recipientText),
    [recipientText],
  );
  const invalidCount = useMemo(
    () =>
      recipients.filter(
        (address) => !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(address),
      ).length,
    [recipients],
  );

  function prepareSend() {
    setError("");
    setResult(null);
    try {
      validateSubject(subject);
      validateMessage(messageText);
      validateRecipients(recipients, DEFAULT_MAX_RECIPIENTS);
      validateAttachmentMetadata(attachments, {
        maxFiles: DEFAULT_MAX_FILES,
        maxFileBytes: DEFAULT_MAX_FILE_BYTES,
        maxTotalBytes: DEFAULT_MAX_TOTAL_BYTES,
      });
      setIsConfirming(true);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Check the form and try again.",
      );
    }
  }

  async function sendEmail() {
    if (sendingLock.current) return;
    sendingLock.current = true;
    setIsConfirming(false);
    setIsSending(true);
    setError("");
    setResult(null);

    try {
      const form = new FormData();
      form.set("subject", subject);
      form.set("recipients", recipients.join("\n"));
      form.set("messageHtml", message);
      attachments.forEach((file) => form.append("attachments", file));

      const response = await fetch("/api/email/send", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as SendResult & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "The message could not be sent.");
      setResult(body);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The message could not be sent.",
      );
    } finally {
      sendingLock.current = false;
      setIsSending(false);
    }
  }

  function addAttachments(selection: FileList | null) {
    if (!selection) return;
    setAttachments((current) => [...current, ...Array.from(selection)]);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a
          className="wordmark"
          href="#top"
          aria-label="Loctus Bulk Email Sender home"
        >
          <Image
            className="Loctus-mark"
            src="/Loctus-mark.svg"
            width={32}
            height={32}
            alt=""
            priority
          />
          <span>Loctus</span>
        </a>
        <span className="topbar-note">
          GROW <span className="tagline-separator">•</span> BUILD{" "}
          <span className="tagline-separator">•</span> SUCCEED
        </span>
      </header>

      <section className="workspace" id="top">
        <div className="intro">
          <p className="eyebrow">
            <span className="status-dot" /> READY TO SEND
          </p>
          <h1>Bulk Email Sender</h1>
          <p className="intro-copy">
            One message, delivered privately to every recipient.
          </p>
        </div>

        <form
          className="compose"
          suppressHydrationWarning
          onSubmit={(event) => {
            event.preventDefault();
            prepareSend();
          }}
        >
          <div className="field">
            <label htmlFor="subject">
              <span className="field-index">01</span>Email Subject
            </label>
            <input
              id="subject"
              suppressHydrationWarning
              maxLength={200}
              placeholder="A clear subject line"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={isSending}
              required
            />
          </div>

          <div className="field">
            <div className="label-row">
              <label htmlFor="recipients">
                <span className="field-index">02</span>Recipient Emails
              </label>
              <span className="count">
                <strong>{recipients.length}</strong>{" "}
                {recipients.length === 1 ? "recipient" : "recipients"}
              </span>
            </div>
            <textarea
              id="recipients"
              suppressHydrationWarning
              className="recipients-input"
              placeholder={
                "alex@example.com, sam@example.com\nteam@example.com"
              }
              value={recipientText}
              onChange={(event) => setRecipientText(event.target.value)}
              disabled={isSending}
              required
              spellCheck={false}
            />
            <div className="field-footnote">
              <span>
                Separate addresses with commas, semicolons, or new lines.
              </span>
              {invalidCount > 0 && (
                <span className="invalid-count">{invalidCount} invalid</span>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="message">
              <span className="field-index">03</span>Email Message
            </label>
            <EmailEditor
              value={message}
              onChange={(html, text) => {
                setMessage(html);
                setMessageText(text);
              }}
              disabled={isSending}
            />
          </div>

          <div className="field attachment-field">
            <div className="label-row">
              <label htmlFor="attachments">
                <span className="field-index">04</span>Attach File{" "}
                <span className="optional">OPTIONAL</span>
              </label>
              <button
                className="add-file"
                type="button"
                suppressHydrationWarning
                onClick={() => fileInput.current?.click()}
                disabled={isSending}
              >
                <span aria-hidden="true">+</span> Add files
              </button>
              <input
                ref={fileInput}
                id="attachments"
                suppressHydrationWarning
                className="visually-hidden"
                type="file"
                multiple
                accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                onChange={(event) => addAttachments(event.target.files)}
                disabled={isSending}
              />
            </div>
            {attachments.length === 0 ? (
              <button
                className="drop-hint"
                type="button"
                suppressHydrationWarning
                onClick={() => fileInput.current?.click()}
                disabled={isSending}
              >
                <span className="clip-icon" aria-hidden="true">
                  ⌁
                </span>
                <span>Choose files to attach</span>
                <span className="file-types">
                  PDF, TXT, CSV, images, Office documents
                </span>
              </button>
            ) : (
              <ul className="file-list" aria-label="Selected attachments">
                {attachments.map((file, index) => (
                  <li
                    className="file-row"
                    key={`${file.name}-${file.lastModified}-${index}`}
                  >
                    <span className="file-icon" aria-hidden="true">
                      FILE
                    </span>
                    <span className="file-name">
                      {file.name}
                      <small>{formatBytes(file.size)}</small>
                    </span>
                    <button
                      className="remove-file"
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                      disabled={isSending}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="notice error-notice" role="alert">
              {error}
            </p>
          )}
          {result && (
            <div
              className={`notice result-notice ${result.failed ? "partial-result" : ""}`}
              role="status"
            >
              <strong>{result.sent} sent</strong>
              <span className="result-divider">/</span>
              <strong>{result.failed} failed</strong>
              {result.error && (
                <span className="result-error">{result.error}</span>
              )}
            </div>
          )}

          <div className="submit-row">
            <span className="privacy-note">
              <span className="lock-icon" aria-hidden="true">
                ◈
              </span>{" "}
              Recipients are sent individually
            </span>
            <button className="send-button" type="submit" disabled={isSending}>
              {isSending ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Sending...
                </>
              ) : (
                <>
                  Send Email <span aria-hidden="true">↗</span>
                </>
              )}
            </button>
          </div>
        </form>

        <footer className="page-footer">
          <span>Loctus / COMPOSE</span>
          <span>SECURE SMTP DELIVERY</span>
        </footer>
      </section>

      {isConfirming && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsConfirming(false);
          }}
        >
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <p className="eyebrow">
              <span className="status-dot" /> FINAL CHECK
            </p>
            <h2 id="confirm-title">Send this message?</h2>
            <p className="confirm-copy">
              Your email will be sent as a separate message to each recipient.
            </p>
            <dl className="confirm-details">
              <div>
                <dt>Subject</dt>
                <dd>{subject}</dd>
              </div>
              <div>
                <dt>Recipients</dt>
                <dd>{recipients.length}</dd>
              </div>
            </dl>
            <div className="dialog-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setIsConfirming(false)}
              >
                Review message
              </button>
              <button type="button" className="send-button" onClick={sendEmail}>
                Confirm send <span aria-hidden="true">↗</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
