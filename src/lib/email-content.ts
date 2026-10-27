import sanitizeHtml from "sanitize-html";
import { convert } from "html-to-text";

const EMAIL_BUTTON_ERROR = "Email buttons must use a valid http:// or https:// destination URL.";

export function sanitizeEmailHtml(input: string): string {
  if (input.length > 200_000) throw new Error("Email HTML is too large.");

  return sanitizeHtml(input, {
    allowedTags: [
      "a", "b", "blockquote", "br", "div", "em", "h1", "h2", "h3", "hr", "i", "li",
      "ol", "p", "s", "span", "strike", "strong", "u", "ul",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel", "style", "data-email-button", "data-button-bg", "data-button-text"],
      div: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      p: ["style"],
      span: ["style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[\da-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        "background-color": [/^#[\da-f]{3,8}$/i, /^rgb\([\d\s,.%]+\)$/i],
        "font-size": [/^(?:12|14|16|18|24|32)px$/],
        "font-weight": [/^(?:400|500|600|700|bold)$/],
        "font-style": [/^italic$/],
        "text-decoration": [/^(?:underline|line-through|none)$/],
        "text-align": [/^(?:left|center|right)$/],
        display: [/^inline-block$/],
        padding: [/^\d{1,2}px(?:\s+\d{1,2}px){0,3}$/],
        "border-radius": [/^\d{1,2}px$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => {
        if (attributes["data-email-button"] === "true") {
          let url: URL;
          try {
            url = new URL(attributes.href ?? "");
          } catch {
            throw new Error(EMAIL_BUTTON_ERROR);
          }
          if (url.protocol !== "https:" && url.protocol !== "http:") {
            throw new Error(EMAIL_BUTTON_ERROR);
          }

          const background = attributes["data-button-bg"];
          const text = attributes["data-button-text"];
          const safeBackground = /^#[\da-f]{6}$/i.test(background ?? "") ? background : "#236a53";
          const safeText = /^#[\da-f]{6}$/i.test(text ?? "") ? text : "#ffffff";
          return {
            tagName: "a",
            attribs: {
              href: url.toString(),
              target: "_blank",
              rel: "noopener noreferrer",
              "data-email-button": "true",
              "data-button-bg": safeBackground!,
              "data-button-text": safeText!,
              style: `display:inline-block;background-color:${safeBackground};color:${safeText};padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:700;`,
            },
          };
        }

        return { tagName: "a", attribs: attributes };
      },
    },
  });
}

export function emailHtmlToText(safeHtml: string): string {
  return convert(safeHtml, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
    ],
  }).trim();
}

export function validateEmailContent(input: string): { html: string; text: string } {
  const html = sanitizeEmailHtml(input);
  const text = emailHtmlToText(html);
  if (!text.trim()) throw new Error("Enter an email message.");
  if (text.length > 100_000) throw new Error("Message must be 100,000 characters or fewer.");
  return { html, text };
}