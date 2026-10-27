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
   EMAIL_BRAND_NAME=Loctus
   EMAIL_TAGLINE=Grow • Build • Succeed
   EMAIL_PRIMARY_COLOR=#0B1F44
   EMAIL_ACCENT_COLOR=#F5B301
   EMAIL_LOGO_URL=https://your-domain.example/Loctus-mark.svg
   ```

   Use the SMTP login and SMTP key from Brevo's SMTP settings, not an API key. The sender email must be verified in Brevo. These variables are read only by the server and must never use a `NEXT_PUBLIC_` prefix. `.env.local` is ignored by Git.

3. Start the development server:

   ```sh
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Use

Enter a subject, recipient addresses separated by commas, semicolons, or new lines, and the message. Duplicate recipient addresses are removed case-insensitively. Add optional attachments and remove them individually as needed. After confirmation, the app sends one email per address, with the same subject, text/HTML message, and attachments; recipients do not appear in one another's messages.

The Email Message field uses Tiptap for rich-text formatting: bold, italic, underline, strikethrough, font sizing, text/highlight colors, lists, alignment, links, undo/redo, and clear formatting. Use **Insert Button** to add an email-compatible clickable link button; select it later to edit its text, URL, and colors, or remove it. Button URLs must use `https://` or `http://`.

The editor submits HTML to the server. Before sending, server-side sanitization removes scripts, event handlers, unsafe protocols, and unsupported styles. The sanitized HTML is sent through Nodemailer as `html`, with a plain-text fallback generated from the same content as `text`. Rich formatting and button colors are restricted to inline styles supported by common email clients.

The backend wraps each recipient's sanitized message in a concise white Loctus table template with a compact wordmark, thin gold divider, personalized greeting, message, simple sign-off, and only configured footer contact details. It sends the same essential content as HTML and plain text. Configure `EMAIL_BRAND_NAME`, `EMAIL_PRIMARY_COLOR`, and `EMAIL_ACCENT_COLOR` on the server to change the defaults. Optional footer fields are `EMAIL_FOOTER_TEXT`, `EMAIL_CONTACT_EMAIL`, `EMAIL_CONTACT_PHONE`, and `EMAIL_WEBSITE_URL`; they are omitted when blank, and no contact details are invented. The marketing tagline remains available to the web interface but is omitted from routine one-to-one email content.

The vector logo is in `public/Loctus-mark.svg`, with an email-compatible PNG rendition in `public/Loctus-mark.png`. By default, the backend attaches the PNG inline with a Content-ID, so the Loctus mark can display in email without a remote image host. Optionally set `EMAIL_LOGO_URL` to a publicly reachable HTTPS logo URL after deploying the asset to your domain. Do not use a local path, localhost URL, or an example URL in production. Branding settings are server-side and require a server restart after changes.

## Deliverability

Template design does not prevent spam placement. The configured sender in the current local setup uses a `hotmail.com` address. Public DNS shows Microsoft's SPF policy (`include:spf2.outlook.com -all`) and a DMARC policy of `p=none`; a Microsoft DKIM selector is present. These records authenticate Microsoft's mail service, not Brevo, and Hotmail DNS is not yours to change. The app aligns `Reply-To` with `From` by default, uses Loctus as the configured display name, requires STARTTLS on port 587, and logs per-message IDs, SMTP response codes, accepted/rejected counts, and sanitized failure categories without logging addresses or message content. These logs indicate SMTP acceptance/rejection only; they do not prove inbox delivery or folder placement. I cannot verify sender approval or Brevo account logs from this workspace.

For authenticated sending, use a sender address on a domain you control and verify that sender/domain in Brevo. In Brevo's domain-authentication page, obtain the exact SPF and DKIM records for the account and publish them at your domain's DNS host. Keep one SPF TXT record and merge Brevo's include into the existing SPF record rather than adding another SPF record. Publish Brevo's DKIM record exactly as provided. Add DMARC at `_dmarc.your-domain` (start with monitoring `p=none`, review reports, then consider stronger policy after all legitimate sources are authenticated). Align the visible From domain with the authenticated domain. DNS records and sender verification must be completed by the domain owner; never try to edit Microsoft's `hotmail.com` DNS.

Gmail Spam and Promotions are different placements. Promotions/Newsletter categorization is not a spam rejection. To validate actual delivery, send to controlled Gmail and company mailboxes, use Gmail **Show original** to inspect SPF/DKIM/DMARC and headers, and compare with Brevo's message logs for SMTP acceptance, blocks, and bounces. This workspace has no access to the received Gmail message or Brevo account logs, so folder placement and final authentication results remain unverified. If these are marketing campaigns, only send to consented recipients and configure a compliant unsubscribe mechanism; do not disguise campaigns as personal correspondence.

The server allows up to 500 recipients, 5 files, 10 MB per file, and 20 MB total attachment data by default. Limits and worker/rate controls can be changed in `.env.local` with `MAX_RECIPIENTS`, `MAX_ATTACHMENT_FILES`, `MAX_ATTACHMENT_SIZE_MB`, `MAX_TOTAL_ATTACHMENT_SIZE_MB`, `SEND_CONCURRENCY`, and `SEND_RATE_PER_SECOND`. Allowed file types are PDF, TXT, CSV, PNG, JPG/JPEG, DOC/DOCX, and XLS/XLSX.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Without valid Brevo SMTP settings, the UI and validation remain usable, but real delivery returns a clear configuration error.
