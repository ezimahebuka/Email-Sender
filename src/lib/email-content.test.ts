import { describe, expect, it } from "vitest";
import {
  emailHtmlToText,
  sanitizeEmailHtml,
  validateEmailContent,
} from "./email-content";

describe("email HTML processing", () => {
  it("preserves supported formatting and creates a plain-text fallback", () => {
    const result = validateEmailContent(
      '<p style="text-align:center"><strong>Welcome</strong> <u>aboard</u></p><ul><li>First</li></ul>',
    );

    expect(result.html).toContain("<strong>Welcome</strong>");
    expect(result.html).toContain("text-align:center");
    expect(result.text).toContain("Welcome aboard");
    expect(result.text).toContain("First");
  });

  it("removes scripts, event handlers, and unsafe links", () => {
    const clean = sanitizeEmailHtml(
      '<p onclick="alert(1)">Hello<script>alert(1)</script></p><a href="javascript:alert(1)">unsafe</a>',
    );

    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(emailHtmlToText(clean)).toContain("Hello");
  });

  it("rejects email buttons with non-http(s) destinations", () => {
    expect(() =>
      sanitizeEmailHtml(
        '<a data-email-button="true" data-button-bg="#236a53" data-button-text="#ffffff" href="javascript:alert(1)">Click</a>',
      ),
    ).toThrow("valid http:// or https:// destination");
  });

  it("rewrites button markup to an email-compatible styled anchor", () => {
    const safe = sanitizeEmailHtml(
      '<a data-email-button="true" data-button-bg="#336699" data-button-text="#ffffff" href="https://example.com">Visit</a>',
    );

    expect(safe).toContain('href="https://example.com/"');
    expect(safe).toContain("display:inline-block");
    expect(safe).toContain("background-color:#336699");
    expect(safe).toContain('target="_blank"');
  });

  it("rejects empty message content", () => {
    expect(() => validateEmailContent("<p><br></p>")).toThrow(
      "Enter an email message",
    );
  });
});
