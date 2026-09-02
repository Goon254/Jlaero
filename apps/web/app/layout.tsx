import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jlaero.com"),
  title: {
    default: "Jlaero: Private Aviation Marketplace",
    template: "%s",
  },
  description:
    "Charter private jets, hire pilots and crew, and buy or list aircraft, all in one marketplace.",
  openGraph: {
    siteName: "Jlaero",
    type: "website",
    title: "Jlaero: Private Aviation Marketplace",
    description:
      "Charter private jets, hire pilots and crew, and buy or list aircraft, all in one marketplace.",
  },
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
