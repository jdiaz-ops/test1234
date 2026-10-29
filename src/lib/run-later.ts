import { after } from "next/server";

/// Corre `work` después de responder si estamos dentro de una petición
/// (no demora el webhook de Wompi ni la acción de la marca); fuera de una
/// petición (pruebas, scripts) lo corre directo y devuelve su promesa.
export function runLater(work: () => Promise<unknown>): Promise<unknown> | undefined {
  try {
    after(work);
  } catch {
    return work();
  }
}
