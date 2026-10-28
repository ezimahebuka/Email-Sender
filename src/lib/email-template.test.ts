import { describe, expect, it } from "vitest";
import {
  brandingFromEnvironment,
  extractRecipientName,
  findBrandLogoAsset,
  renderEmailTemplate,
} from "./email-template";
import { validateEmailContent } from "./email-content";

describe("extractRecipientName", () => {
  it.each([
    ["ebuka.ezimah@gmail.com", "Ebuka Ezimah"],
    ["Ebuka_Ezimah@gmail.com", "Ebuka Ezimah"],
    ["john-doe@gmail.com", "John Doe"],
    ["favour@gmail.com", "Favour"],
    ["---@example.com", ""],
    ["12345@example.com", ""],
  ])("extracts a readable name from %s", (email, expected) => {
    expect(extractRecipientName(email)).toBe(expected);
  });
});

describe("renderEmailTemplate", () => {
  const content =
    '<p><strong>Important</strong> update</p><a data-email-button="true" href="https://example.com" style="display:inline-block;background-color:#236a53;color:#ffffff;padding:12px 20px">Open</a>';

  it("renders personalized greetings separately with shared rich content", () => {
    const ebuka = renderEmailTemplate(
      "ebuka.ezimah@gmail.com",
      content,
      "Important update\nOpen",
    );
    const john = renderEmailTemplate(
      "john-doe@yahoo.com",
      content,
      "Important update\nOpen",
    );

    expect(ebuka.html).toContain("Hi Ebuka Ezimah,");
    expect(john.html).toContain("Hi John Doe,");
    expect(ebuka.html).not.toContain("@gmail.com");
    expect(john.html).not.toContain("@yahoo.com");
    expect(ebuka.text).toContain("Hi Ebuka Ezimah,");
    expect(john.text).toContain("Hi John Doe,");
    expect(ebuka.html).toContain("<strong>Important</strong>");
    expect(ebuka.html).toContain("https://example.com");
    expect(ebuka.html).toContain('role="presentation"');
    expect(ebuka.html).toContain("background-color:#ffffff");
    expect(ebuka.html).not.toContain("Grow • Build • Succeed");
    expect(ebuka.text).toContain("Important update");
    expect(ebuka.text).toContain("Open");
    expect(ebuka.text).not.toContain("Grow • Build • Succeed");
    expect(ebuka.text).not.toContain("@gmail.com");
  });

  it("uses a neutral greeting and a compact white Loctus layout without invented contacts", () => {
    const rendered = renderEmailTemplate(
      "12345@example.com",
      "<p>Hello body</p>",
      "Hello body",
    );
    expect(rendered.html).toContain("Hello,");
    expect(rendered.html).toContain("Loctus");
    expect(rendered.html).toContain('src="cid:Loctus-mark"');
    expect(rendered.html).toContain("border-bottom:1px solid #F5B301");
    expect(rendered.html).toContain("border-top:1px solid #e4e8ee");
    expect(rendered.html).toContain("Regards,");
    expect(rendered.html).not.toContain("Grow • Build • Succeed");
    expect(rendered.html).not.toContain("Company");
    expect(rendered.html).not.toContain("https://example.com");
    expect(rendered.text).toContain("Hello,\n\nHello body");
    expect(rendered.text).toContain("Regards,\nLoctus");
  });

  it("finds the actual brand asset in the public folder even when the name casing differs", () => {
    const logoPath = findBrandLogoAsset();
    expect(logoPath).toMatch(/lotus-mark\.png$/i);
  });

  it("keeps Loctus as the default brand even when the SMTP sender label differs", () => {
    const branding = brandingFromEnvironment({
      BREVO_SENDER_NAME: "Different Sender",
    });
    const rendered = renderEmailTemplate(
      "person@example.com",
      "<p>Body</p>",
      "Body",
      branding,
    );

    expect(branding.brandName).toBe("Loctus");
    expect(rendered.html).toContain("Loctus");
    expect(rendered.html).not.toContain("Different Sender");
  });

  it("uses configured brand, optional logo and contact details, with validated accent", () => {
    const branding = brandingFromEnvironment({
      EMAIL_BRAND_NAME: "Northwind Studio",
      EMAIL_LOGO_URL: "https://cdn.example.com/logo.png",
      EMAIL_TAGLINE: "Think • Make • Grow",
      EMAIL_PRIMARY_COLOR: "#112244",
      EMAIL_ACCENT_COLOR: "#456789",
      EMAIL_FOOTER_TEXT: "Questions? Reply to this email.",
      EMAIL_CONTACT_EMAIL: "team@example.com",
      EMAIL_CONTACT_PHONE: "+1 555 0100",
      EMAIL_WEBSITE_URL: "https://example.com",
    });
    const rendered = renderEmailTemplate(
      "favour@gmail.com",
      "<p>Welcome</p>",
      "Welcome",
      branding,
    );

    expect(rendered.html).toContain("Northwind Studio");
    expect(rendered.html).toContain("cdn.example.com/logo.png");
    expect(rendered.html).not.toContain("Think • Make • Grow");
    expect(rendered.html).not.toContain("background-color:#112244");
    expect(rendered.html).toContain("border-bottom:1px solid #456789");
    expect(rendered.html).toContain("team@example.com");
    expect(rendered.html).toContain("Questions? Reply to this email.");
    expect(rendered.text).toContain("Hi Favour,");
    expect(rendered.text).toContain("+1 555 0100");
  });

  it("escapes configured text and ignores unsafe logo and website URLs", () => {
    const branding = brandingFromEnvironment({
      EMAIL_BRAND_NAME: "<script>Bad</script>",
      EMAIL_LOGO_URL: "http://cdn.example.com/logo.png",
      EMAIL_WEBSITE_URL: "data:text/html,bad",
      EMAIL_ACCENT_COLOR: "red; background-image:url(x)",
    });
    const rendered = renderEmailTemplate(
      "person@example.com",
      "<p>Body</p>",
      "Body",
      branding,
    );

    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).not.toContain("javascript:");
    expect(rendered.html).not.toContain("cdn.example.com/logo.png");
    expect(rendered.html).not.toContain("data:text/html");
    expect(rendered.html).toContain("border-bottom:1px solid #F5B301");
  });

  it("keeps sanitized formatting and button content in separate recipient emails", () => {
    const { html, text } = validateEmailContent(
      '<p><strong>Important update</strong></p><ul><li>Read the details</li></ul><a data-email-button="true" data-button-bg="#336699" data-button-text="#ffffff" href="https://example.com/register">Register Now</a>',
    );
    const first = renderEmailTemplate("ebuka.ezimah@gmail.com", html, text, {
      brandName: "Example Team",
    });
    const second = renderEmailTemplate("john-doe@yahoo.com", html, text, {
      brandName: "Example Team",
    });

    expect(first.html).toContain("Hi Ebuka Ezimah,");
    expect(second.html).toContain("Hi John Doe,");
    expect(first.html).toContain("<strong>Important update</strong>");
    expect(second.html).toContain("<strong>Important update</strong>");
    expect(first.html).toContain("background-color:#336699");
    expect(second.html).toContain('href="https://example.com/register"');
    expect(first.text).toContain("Hi Ebuka Ezimah,");
    expect(second.text).toContain("Hi John Doe,");
    expect(first.text).toContain("Register Now");
    expect(first.text).toContain("https://example.com/register");
    expect(first.text).not.toContain("@gmail.com");
  });
});
