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
  openGraph: {
    title: "Catalyst Procurement OS",
    description: "Intelligence for every purchasing decision",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1736,
        height: 908,
        alt: "Catalyst Procurement OS social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalyst Procurement OS",
    description: "Intelligence for every purchasing decision",
    images: ["/og.png"],
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
