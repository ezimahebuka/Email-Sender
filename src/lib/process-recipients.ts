import { PUBLIC_SMTP_ERRORS } from "./smtp-errors";

export type RecipientOutcome = {
  email: string;
  success: boolean;
  error?: string;
};

export async function processRecipients(
  recipients: string[],
  sendOne: (recipient: string) => Promise<void>,
  concurrency: number,
): Promise<RecipientOutcome[]> {
  const outcomes: RecipientOutcome[] = new Array(recipients.length);
  let nextIndex = 0;
  const workerCount = Math.max(
    1,
    Math.min(Math.floor(concurrency), recipients.length),
  );

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < recipients.length) {
        const index = nextIndex++;
        const email = recipients[index];
        try {
          await sendOne(email);
          outcomes[index] = { email, success: true };
        } catch (error) {
          const publicError = (error as { publicError?: unknown })?.publicError;
          outcomes[index] = {
            email,
            success: false,
            error:
              typeof publicError === "string" &&
              PUBLIC_SMTP_ERRORS.includes(publicError)
                ? publicError
                : "Delivery failed.",
          };
        }
      }
    }),
  );

  return outcomes;
}
