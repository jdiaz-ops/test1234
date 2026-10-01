import type { Metadata } from "next";
import { UtmCapture } from "@/components/marketing/utm-capture";
import { CreatorWaitlistForm } from "@/components/marketing/creator-waitlist-form";

export const metadata: Metadata = {
  title: "Lista de espera para creadores — Marcolini",
  description: "Déjanos tus datos y te avisamos cuando abramos tu acceso a Marcolini.",
};

export default function ListaDeEsperaPage() {
  return (
    <>
      <UtmCapture />
      <CreatorWaitlistForm />
    </>
  );
}
