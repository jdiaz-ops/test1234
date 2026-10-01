import type { Metadata } from "next";
import { UtmCapture } from "@/components/marketing/utm-capture";
import { BrandWaitlistForm } from "@/components/marketing/brand-waitlist-form";

export const metadata: Metadata = {
  title: "Lista de espera para marcas — Marcolini",
  description: "Déjanos los datos de tu marca y te contactamos cuando abramos tu acceso a Marcolini.",
};

export default function ListaDeEsperaMarcasPage() {
  return (
    <>
      <UtmCapture />
      <BrandWaitlistForm />
    </>
  );
}
