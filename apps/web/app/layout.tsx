import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://jlaero.com"),
  title: {
    default: "Jlaero: Private Jet Charter",
    template: "%s",
  },
  description:
    "Request a private jet charter and get up to three verified aircraft options, with a broker handling every detail.",
  openGraph: {
    siteName: "Jlaero",
    type: "website",
    title: "Jlaero: Private Jet Charter",
    description:
      "Request a private jet charter and get up to three verified aircraft options, with a broker handling every detail.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
