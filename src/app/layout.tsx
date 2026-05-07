import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { appConfig, isClerkConfigured, siteUrl } from "@/lib/config";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${appConfig.name} | Reddit Demand Discovery for Founders`,
    template: `%s | ${appConfig.name}`,
  },
  description: appConfig.description,
  applicationName: appConfig.name,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Reddit SEO",
    "Reddit lead generation",
    "Reddit marketing",
    "buyer intent discovery",
    "founder growth tools",
    "Reddit growth workflow",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: appConfig.name,
    title: `${appConfig.name} | Reddit Demand Discovery for Founders`,
    description: appConfig.description,
    images: [
      {
        url: "/redditgrowthos-hero.png",
        width: 1600,
        height: 900,
        alt: "RedditGrowthOS workspace preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${appConfig.name} | Reddit Demand Discovery for Founders`,
    description: appConfig.description,
    images: ["/redditgrowthos-hero.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "business",
};

function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!isClerkConfigured) {
    return children;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
