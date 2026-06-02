import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Approval Site – Recipient Verification Portal",
  description:
    "Submit recipient information and manage approvals for the donation platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
