import type { Metadata } from "next";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Catalyst Procurement OS",
    template: "%s | Catalyst Procurement OS",
  },
  description:
    "A premium AI procurement operating system demonstration by Catalyst Innovations.",
  icons: {
    icon: "/brand/y12/favicon.png",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Catalyst Procurement OS",
    description: "Intelligence for every purchasing decision",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalyst Procurement OS",
    description: "Intelligence for every purchasing decision",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("catalyst-theme")||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.add(d?"dark":"light")}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
