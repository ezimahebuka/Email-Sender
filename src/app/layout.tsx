import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bulk Email Sender",
  description: "Send a message to a list of recipients with Brevo SMTP.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
