import { describe, expect, it } from "vitest";
import {
  classifySmtpError,
  SMTP_AUTH_ERROR,
  SMTP_RATE_ERROR,
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
  });

  it("does not expose unrecognized SMTP internals", () => {
    expect(
      classifySmtpError({
        code: "ECONNECTION",
        response: "internal host detail",
      }),
    ).toBeUndefined();
  });
});
