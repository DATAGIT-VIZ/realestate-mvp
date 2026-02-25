import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
 variable: "--font-inter",
 subsets: ["latin"],
 weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
 title: "RealEstate CRM — Lead Management & Analytics",
 description: "Professional real estate CRM with AI-powered lead scoring, Kanban pipeline management, and advanced analytics.",
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
  <html lang="en">
   <body className={`${inter.variable} font-sans antialiased`}>
    {children}
   </body>
  </html>
 );
}
