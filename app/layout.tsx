import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ETF Volume Flow Dashboard",
  description: "Daily ETF volume flow tracker — ratio vs 30-day average",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0d0f14" }}>
        {children}
      </body>
    </html>
  );
}
