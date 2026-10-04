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

/// Tagline aprobado por Juan el 2026-10-03 (Marcolini se enfoca primero en
/// uñas). Es lo que muestran Google y WhatsApp/Instagram al compartir el
/// link; el mismo texto va debajo del logo en la portada.
const TAGLINE =
  "Somos la plataforma que conecta marcas de uñas con una red seleccionada de creadoras de contenido. Ellas convierten su contenido e influencia en comisiones. Las marcas solo pagan cuando venden.";

export const metadata: Metadata = {
  title: "Marcolini",
  description: TAGLINE,
  openGraph: { title: "Marcolini", description: TAGLINE, siteName: "Marcolini", locale: "es_CO", type: "website" },
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
