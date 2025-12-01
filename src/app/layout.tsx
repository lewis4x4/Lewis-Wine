import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pourfolio - Your Wine Portfolio",
    template: "%s | Pourfolio",
  },
  description:
    "Track, rate, and manage your wine collection with Pourfolio. Scan barcodes, log tastings, and discover your perfect drinking windows.",
  keywords: [
    "wine",
    "cellar",
    "wine collection",
    "wine tracker",
    "wine ratings",
    "wine portfolio",
  ],
  authors: [{ name: "Pourfolio" }],
  creator: "Pourfolio",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pourfolio",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Pourfolio",
    title: "Pourfolio - Your Wine Portfolio",
    description:
      "Track, rate, and manage your wine collection with Pourfolio.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pourfolio - Your Wine Portfolio",
    description:
      "Track, rate, and manage your wine collection with Pourfolio.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#722F37",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
