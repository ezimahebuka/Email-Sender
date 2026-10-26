import { describe, expect, it } from "vitest";
import { processRecipients } from "./process-recipients";

describe("processRecipients", () => {
  it("limits concurrency and records each recipient outcome independently", async () => {
    let active = 0;
    let peak = 0;
    const results = await processRecipients(
      ["a@example.com", "b@example.com", "c@example.com", "d@example.com"],
      async (email) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        if (email === "b@example.com")
          throw new Error("SMTP detail must not be exposed");
      },
      2,
    );

    expect(peak).toBe(2);
    expect(results.map(({ success }) => success)).toEqual([
      true,
      false,
      true,
      true,
    ]);
    expect(results[1].error).toBe("Delivery failed.");
  });

  it("returns no outcomes for an empty recipient list", async () => {
    await expect(
      processRecipients([], async () => undefined, 3),
    ).resolves.toEqual([]);
  });
});
