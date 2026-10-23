/// Recuerda por un rato lo que devuelve `load` para cada clave, en la
/// memoria de esta instancia del servidor (Vercel usa la misma para muchas
/// visitas seguidas). Para lo que se consulta en cada visita y casi nunca
/// cambia: Prisma Postgres cobra cada consulta. También junta las visitas
/// que llegan a la vez en una sola consulta. Un error no se recuerda, y
/// con ttlMs 0 no recuerda nada. Guarda hasta `max` claves (bota las más
/// viejas).
export function rememberFor<T>(ttlMs: number, load: (key: string) => Promise<T>, max = 2000): (key: string) => Promise<T> {
  const saved = new Map<string, { at: number; value: Promise<T> }>();
  return (key) => {
    const now = Date.now();
    const hit = saved.get(key);
    if (hit && now - hit.at < ttlMs) return hit.value;
    const value = load(key);
    if (ttlMs > 0) {
      saved.delete(key);
      saved.set(key, { at: now, value });
      if (saved.size > max) saved.delete(saved.keys().next().value as string);
      value.catch(() => {
        if (saved.get(key)?.value === value) saved.delete(key);
      });
    }
    return value;
  };
}
