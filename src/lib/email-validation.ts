export const DEFAULT_MAX_RECIPIENTS = 500;
export const DEFAULT_MAX_FILES = 5;
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseRecipients(value: string): string[] {
  const unique = new Set<string>();

  for (const candidate of value.split(/[\s,;]+/)) {
    const address = candidate.trim();
    if (address) unique.add(address.toLowerCase());
  }

  return [...unique];
}

export function validateRecipients(
  addresses: string[],
  maximum: number,
): string[] {
  if (addresses.length === 0)
    throw new Error("Add at least one recipient email address.");
  if (addresses.length > maximum)
    throw new Error(`Recipient limit is ${maximum} addresses.`);

  const invalid = addresses.find((address) => !EMAIL_PATTERN.test(address));
  if (invalid) throw new Error(`Invalid email address: ${invalid}`);

  return addresses;
}

export function validateSubject(subject: string): void {
  if (!subject.trim()) throw new Error("Enter an email subject.");
  if (subject.length > 200)
    throw new Error("Subject must be 200 characters or fewer.");
}

export function validateMessage(message: string): void {
  if (!message.trim()) throw new Error("Enter an email message.");
  if (message.length > 100_000)
    throw new Error("Message must be 100,000 characters or fewer.");
}

export function validateAttachmentMetadata(
  files: Array<{ name: string; size: number; type: string }>,
  limits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number },
): void {
  if (files.length > limits.maxFiles)
    throw new Error(`Attach no more than ${limits.maxFiles} files.`);

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > limits.maxTotalBytes) {
    throw new Error(
      `Attachments must total no more than ${formatBytes(limits.maxTotalBytes)}.`,
    );
  }

  for (const file of files) {
    if (file.size <= 0) throw new Error(`${file.name} is empty.`);
    if (file.size > limits.maxFileBytes) {
      throw new Error(
        `${file.name} exceeds the ${formatBytes(limits.maxFileBytes)} per-file limit.`,
      );
    }
    if (!isAllowedAttachment(file.name, file.type)) {
      throw new Error(`${file.name} has an unsupported file type.`);
    }
  }
}

export function isAllowedAttachment(name: string, type: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase();
  const allowed: Record<string, string[]> = {
    pdf: ["application/pdf"],
    txt: ["text/plain", ""],
    csv: ["text/csv", "application/vnd.ms-excel", ""],
    png: ["image/png"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    doc: ["application/msword", "application/octet-stream"],
    docx: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
    ],
    xls: ["application/vnd.ms-excel", "application/octet-stream"],
    xlsx: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ],
  };

  return Boolean(extension && allowed[extension]?.includes(type.toLowerCase()));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
