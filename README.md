# Bulk Email Sender

A small Next.js App Router application for sending one message separately to each recipient through Brevo SMTP. It has no database or authentication, and uploaded files are held in memory only for the duration of a send request.

## Requirements

- Node.js 20.9 or later
- A Brevo account with SMTP access and a verified sender address

## Install and configure

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the server-only settings:

   ```dotenv
   BREVO_SMTP_HOST=smtp-relay.brevo.com
   BREVO_SMTP_PORT=587
   BREVO_SMTP_USER=your-brevo-smtp-login
   BREVO_SMTP_KEY=your-brevo-smtp-key
   BREVO_SENDER_EMAIL=verified-sender@example.com
   BREVO_SENDER_NAME=Your Name
   ```

   Use the SMTP login and SMTP key from Brevo's SMTP settings, not an API key. The sender email must be verified in Brevo. These variables are read only by the server and must never use a `NEXT_PUBLIC_` prefix. `.env.local` is ignored by Git.

3. Start the development server:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Use

Enter a subject, recipient addresses separated by commas, semicolons, or new lines, and the message. Duplicate recipient addresses are removed case-insensitively. Add optional attachments and remove them individually as needed. After confirmation, the app sends one email per address, with the same subject, text/HTML message, and attachments; recipients do not appear in one another's messages.

The server allows up to 500 recipients, 5 files, 10 MB per file, and 20 MB total attachment data by default. Limits and worker/rate controls can be changed in `.env.local` with `MAX_RECIPIENTS`, `MAX_ATTACHMENT_FILES`, `MAX_ATTACHMENT_SIZE_MB`, `MAX_TOTAL_ATTACHMENT_SIZE_MB`, `SEND_CONCURRENCY`, and `SEND_RATE_PER_SECOND`. Allowed file types are PDF, TXT, CSV, PNG, JPG/JPEG, DOC/DOCX, and XLS/XLSX.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Without valid Brevo SMTP settings, the UI and validation remain usable, but real delivery returns a clear configuration error.
