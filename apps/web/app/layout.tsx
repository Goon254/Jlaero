import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jlaero: Private Aviation Marketplace",
  description:
    "Charter private jets, hire pilots and crew, and buy or list aircraft, all in one marketplace.",
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
