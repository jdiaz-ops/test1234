import { describe, expect, it } from "vitest";
import { buildMenuTree, isMenuPlaceholderUrl, menuDepthOf } from "@/lib/menu-tree";

const rows = [
  { id: "b", label: "Nuestros productos", url: "#", position: 1, parentId: null },
  { id: "a", label: "Inicio", url: "/", position: 0, parentId: null },
  { id: "b2", label: "Decoración", url: "/coleccion/decoracion", position: 1, parentId: "b" },
  { id: "b1", label: "Semipermanentes", url: "/coleccion/semipermanentes", position: 0, parentId: "b" },
  { id: "b21", label: "Glitter gel", url: "/coleccion/glitter-gel", position: 0, parentId: "b2" },
  // Un cuarto nivel no se muestra (el menú tiene hasta tres).
  { id: "b211", label: "Rosa", url: "/glitter-rosa", position: 0, parentId: "b21" },
];

describe("buildMenuTree", () => {
  it("arma el árbol por parentId, ordenado por posición en cada nivel", () => {
    expect(buildMenuTree(rows)).toEqual([
      { id: "a", label: "Inicio", url: "/", children: [] },
      {
        id: "b",
        label: "Nuestros productos",
        url: "#",
        children: [
          { id: "b1", label: "Semipermanentes", url: "/coleccion/semipermanentes", children: [] },
          {
            id: "b2",
            label: "Decoración",
            url: "/coleccion/decoracion",
            children: [{ id: "b21", label: "Glitter gel", url: "/coleccion/glitter-gel", children: [] }],
          },
        ],
      },
    ]);
  });

  it("un ítem cuyo padre ya no existe sube al primer nivel con sus hijos", () => {
    const tree = buildMenuTree([
      { id: "a", label: "Inicio", url: "/", position: 0, parentId: null },
      { id: "x", label: "Huérfano", url: "/coleccion/x", position: 0, parentId: "borrado" },
      { id: "x1", label: "Hijo", url: "/coleccion/x1", position: 0, parentId: "x" },
    ]);
    expect(tree.map((n) => [n.label, n.children.map((c) => c.label)])).toEqual([
      ["Inicio", []],
      ["Huérfano", ["Hijo"]],
    ]);
  });

  it("sin parentId (los menús viejos) queda plano", () => {
    const tree = buildMenuTree([
      { id: "2", label: "Dos", url: "/dos", position: 1 },
      { id: "1", label: "Uno", url: "/uno", position: 0 },
    ]);
    expect(tree.map((n) => n.label)).toEqual(["Uno", "Dos"]);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it("menuDepthOf cuenta los niveles por encima de un ítem", () => {
    expect(menuDepthOf(rows, "a")).toBe(0);
    expect(menuDepthOf(rows, "b1")).toBe(1);
    expect(menuDepthOf(rows, "b21")).toBe(2);
    expect(menuDepthOf(rows, "no-existe")).toBe(0);
  });

  it("'#' o vacío es un ítem sin link", () => {
    expect(isMenuPlaceholderUrl("#")).toBe(true);
    expect(isMenuPlaceholderUrl(" ")).toBe(true);
    expect(isMenuPlaceholderUrl("/coleccion/x")).toBe(false);
  });
});
