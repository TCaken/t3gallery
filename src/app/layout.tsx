import "~/styles/globals.css";
import "@uploadthing/react/styles.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import {
  ClerkProvider
} from '@clerk/nextjs';

export const metadata: Metadata = {
  title: "AirConnect",
  description: "AirConnect, A CRM App for Marketing",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode, modal: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable}`}>
        <body className="flex flex-col min-h-screen">
          {children}
          <div id="modal-root" />
        </body>
      </html>
    </ClerkProvider>
  );
}
