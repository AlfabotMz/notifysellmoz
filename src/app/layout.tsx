import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotifySell Moz - Automação Shopify + WhatsApp",
  description: "Notificações automáticas de encomendas no WhatsApp para lojas Shopify em Moçambique",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
