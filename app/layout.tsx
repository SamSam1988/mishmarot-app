import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "שיבוצי משמרות",
  description: "מערכת שיבוץ משמרות",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" style={{ colorScheme: "dark" }}>
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body style={{ backgroundColor: "#09090b", color: "#ffffff", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
