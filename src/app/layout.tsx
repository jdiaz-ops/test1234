import type { Metadata } from "next";
import { Instrument_Sans, Karla, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Identidad de marca de Marcolini: "Sistema Confiable" en tono nude/rosado —
// Instrument Sans para titulares, Karla para el cuerpo, IBM Plex Mono para
// datos (comisiones, códigos, %).
const instrumentSans = Instrument_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const karla = Karla({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono-brand",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Marcolini",
  description: "Red de afiliación para la industria de belleza",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${instrumentSans.variable} ${karla.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-brand-bg text-brand-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
