import { describe, expect, it } from "vitest";
import {
  classifySmtpError,
  SMTP_AUTH_ERROR,
  SMTP_CONNECTION_ERROR,
  SMTP_RECIPIENT_ERROR,
  SMTP_RATE_ERROR,
  SMTP_SENDER_ERROR,
} from "./smtp-errors";

describe("SMTP error classification", () => {
  it("returns clear, credential-safe authentication and temporary rate-limit errors", () => {
    expect(
      classifySmtpError({
        responseCode: 535,
        response: "private SMTP response",
      }),
    ).toBe(SMTP_AUTH_ERROR);
    expect(classifySmtpError({ code: "EAUTH" })).toBe(SMTP_AUTH_ERROR);
    expect(classifySmtpError({ responseCode: 421 })).toBe(SMTP_RATE_ERROR);
    expect(classifySmtpError({ responseCode: 553 })).toBe(SMTP_SENDER_ERROR);
    expect(classifySmtpError({ responseCode: 550 })).toBe(SMTP_RECIPIENT_ERROR);
    expect(classifySmtpError({ code: "ECONNECTION" })).toBe(
      SMTP_CONNECTION_ERROR,
    );
  });

  it("returns a safe delivery category without exposing SMTP internals", () => {
    expect(
      classifySmtpError({
        code: "ECONNECTION",
        response: "internal host detail",
      }),
    ).toBe(
      "Could not connect securely to Brevo SMTP. Check the host, port, and TLS configuration.",
    );
    expect(
      classifySmtpError({ responseCode: 554, response: "private response" }),
    ).toBe(
      "Delivery failed. Check your Brevo SMTP configuration and sender address.",
    );
  });
});
