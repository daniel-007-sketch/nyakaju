import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";

export const metadata: Metadata = { title: "NYAKAJU" };

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`scroll-smooth ${montserrat.variable}`} lang="en">
      <body>
        <Script src="/home-nav-scroll.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
