import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { SUGGESTIONS_ENABLED } from "@/lib/features";
import { SuggestionsPage } from "@/components/portal/suggestions-page";
import { listMySuggestions } from "@/server/services/suggestion-service";

export default async function CreadorSugerenciasPage() {
  if (!SUGGESTIONS_ENABLED) notFound();
  const session = await auth();
  const mine = await listMySuggestions(session!.user.id, "CREATOR");
  return <SuggestionsPage mine={mine} />;
}
