import { describe, expect, it } from "vitest";
import {
  parseRecipients,
  validateAttachmentMetadata,
  validateRecipients,
} from "./email-validation";

describe("recipient processing", () => {
  it("splits commas, semicolons, and newlines, then removes case-insensitive duplicates", () => {
    expect(
      parseRecipients(
        "one@example.com; TWO@example.com\none@example.com, three@example.com",
      ),
    ).toEqual(["one@example.com", "two@example.com", "three@example.com"]);
  });

  it("rejects invalid addresses and excessive recipient counts", () => {
    expect(() => validateRecipients(["bad-address"], 5)).toThrow(
      "Invalid email address",
    );
    expect(() =>
      validateRecipients(["a@example.com", "b@example.com"], 1),
    ).toThrow("Recipient limit");
  });
});

describe("attachment validation", () => {
  const limits = { maxFiles: 2, maxFileBytes: 100, maxTotalBytes: 150 };

  it("accepts allowed attachments within limits", () => {
    expect(() =>
      validateAttachmentMetadata(
        [{ name: "brief.pdf", size: 90, type: "application/pdf" }],
        limits,
      ),
    ).not.toThrow();
  });

  it("rejects unsupported types, oversize files, and too many files", () => {
    expect(() =>
      validateAttachmentMetadata(
        [{ name: "script.exe", size: 12, type: "application/octet-stream" }],
        limits,
      ),
    ).toThrow("unsupported file type");
    expect(() =>
      validateAttachmentMetadata(
        [{ name: "large.pdf", size: 101, type: "application/pdf" }],
        limits,
      ),
    ).toThrow("per-file limit");
    expect(() =>
      validateAttachmentMetadata(
        Array.from({ length: 3 }, (_, index) => ({
          name: `${index}.txt`,
          size: 1,
          type: "text/plain",
        })),
        limits,
      ),
    ).toThrow("no more than 2 files");
  });
});
