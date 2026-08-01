import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadHunter — Find Local Businesses With Poor Websites",
  description:
    "Discover local businesses with no website, broken sites, or poor mobile performance. Generate personalized cold pitches and track your outreach.",
  keywords: "lead generation, web design agency, local business, cold outreach",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-bg-base text-slate-200 antialiased">
        {/* Atmospheric overlays */}
        <div className="scan-overlay" aria-hidden="true" />
        <div className="noise-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
