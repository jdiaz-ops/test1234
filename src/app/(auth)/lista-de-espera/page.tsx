import type { Metadata } from "next";
import { UtmCapture } from "@/components/marketing/utm-capture";
import { CreatorWaitlistForm } from "@/components/marketing/creator-waitlist-form";

export const metadata: Metadata = {
  title: "Aplica a la red de creadoras — Marcolini",
  description:
    "Aplicaciones abiertas para creadoras de contenido de uñas e instructoras. Déjanos tus datos y revisaremos tu solicitud para la red seleccionada de Marcolini.",
};

export default function ListaDeEsperaPage() {
  return (
    <>
      <UtmCapture />
      <CreatorWaitlistForm />
    </>
  );
}
