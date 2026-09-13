import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import TRPCProvider from "@/components/providers/TRPCProvider";
import AppShell from "@/components/AppShell";

const lexend = Lexend({
  variable: "--font-lx",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mantis Box Manager",
  description: "Administración de Mantis Box Sabanalarga",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${lexend.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TRPCProvider>
          <AppShell>{children}</AppShell>
        </TRPCProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--tinta)",
              color: "var(--fondo)",
              fontFamily: "var(--font-lx)",
            },
          }}
        />
      </body>
    </html>
  );
}