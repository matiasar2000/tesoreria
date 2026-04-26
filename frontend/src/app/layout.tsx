import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: "Tesorería CBT",
  description: "Sistema de gestión financiera - Cuerpo de Bomberos de Talcahuano",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
