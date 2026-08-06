import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/providers/AppProviders";
import { PwaRegister } from "@/components/layout/PwaRegister";
import { ToastProvider } from "@/components/layout/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockApp — Conteo de Inventario",
  description: "Sistema profesional de conteo de stock físico vs SAP",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StockApp",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
        <ToastProvider />
        <PwaRegister />
      </body>
    </html>
  );
}
