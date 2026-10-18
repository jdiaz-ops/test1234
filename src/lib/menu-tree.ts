/// El menú de la vitrina como árbol (hasta tres niveles): lo que guarda
/// StorefrontMenuItem es plano, con parentId. "#" en la url = sin link,
/// el ítem solo abre su submenú.
export type MenuNode = { id: string; label: string; url: string; children: MenuNode[] };

export const MENU_MAX_DEPTH = 3;

export function isMenuPlaceholderUrl(url: string) {
  return url.trim() === "" || url.trim() === "#";
}

export function buildMenuTree(rows: { id: string; label: string; url: string; position: number; parentId?: string | null }[]): MenuNode[] {
  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const key = row.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), row]);
  }
  const ids = new Set(rows.map((r) => r.id));
  const build = (parentId: string | null, depth: number): MenuNode[] =>
    (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row) => ({ id: row.id, label: row.label, url: row.url, children: depth < MENU_MAX_DEPTH ? build(row.id, depth + 1) : [] }));
  // Un ítem cuyo padre ya no existe se muestra arriba, no se pierde.
  const orphans = rows.filter((r) => r.parentId && !ids.has(r.parentId));
  const top = build(null, 1);
  for (const row of orphans) top.push({ id: row.id, label: row.label, url: row.url, children: build(row.id, 2) });
  return top;
}

/// Cuántos niveles tiene un ítem por encima (0 = nivel de arriba).
export function menuDepthOf(rows: { id: string; parentId?: string | null }[], id: string): number {
  const byId = new Map(rows.map((r) => [r.id, r]));
  let depth = 0;
  let current = byId.get(id);
  while (current?.parentId && depth < 10) {
    depth++;
    current = byId.get(current.parentId);
  }
  return depth;
}
