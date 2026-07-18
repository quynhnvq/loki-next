import type { Metadata } from "next";
import "./globals.css";

const HOME_TITLE = "LOKI | Technology, AI Marketing & Digital Growth";
const HOME_DESCRIPTION =
  "LOKI helps businesses grow through technology, AI-powered marketing, and custom digital solutions. From websites and mobile apps to performance marketing and brand strategy, we build what drives growth.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/marketing/loki-share-thumbnail.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/marketing/loki-share-thumbnail.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Served from /public so LightningCSS does not strip backdrop-filter. */}
        <link rel="stylesheet" href="/styles/landing.css" />
        <link
          rel="preload"
          as="image"
          href="/landing/remix-runner.avif"
          type="image/avif"
          fetchPriority="high"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
