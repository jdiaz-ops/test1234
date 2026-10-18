import { describe, expect, it } from "vitest";
import {
  buildMergeProposal,
  collectionHandleFromHref,
  menuForProposal,
  proposeMergeByRules,
  sanitizeMergeProposal,
  type MergeSourceCollection,
} from "@/lib/collection-merge";

const c = (handle: string, name: string, products: string[]): MergeSourceCollection => ({ handle, name, productHandles: products });

const BEAUTY: MergeSourceCollection[] = [
  c("acrysoft", "AcrySoft™", ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"]),
  c("bases-para-frances", "Bases para Frances", ["b1"]),
  c("builder-gel", "BUILDER GEL", ["bg"]),
  c("extened-gel", "EXTENED GEL", ["eg"]),
  c("gel-polish-azules", "Gel Polish Azules", ["gp-az"]),
  c("gel-polish-blancos", "Gel Polish Blancos, Negros y Grises", ["gp-bl"]),
  c("gel-polish-cafes", "Gel Polish Cafés y Nudes", ["gp-ca"]),
  c("gel-polish-morados", "Gel Polish Morados", ["gp-mo"]),
  c("gel-polish-ojo-de-gato", "Gel Polish Ojo de Gato Reflectivo", ["gp-og"]),
  c("gel-polish-rojos", "Gel Polish Rojos y Amarillos", ["gp-ro"]),
  c("gel-polish-rosados", "Gel Polish Rosados", ["gp-rs"]),
  c("gel-polish-salmon", "Gel Polish Salmón y Naranjas", ["gp-sa"]),
  c("gel-polish-verdes", "Gel Polish Verdes", ["gp-ve"]),
  c("glitters", "Glitters Gel Polish Profesional", ["gl"]),
  c("polygel", "POLYGEL", ["pg"]),
];

describe("proposeMergeByRules", () => {
  it("une las colecciones pequeñas que comparten las dos primeras palabras", () => {
    const proposal = proposeMergeByRules(BEAUTY);
    expect(proposal?.source).toBe("reglas");
    expect(proposal?.collections.map((m) => m.name)).toEqual([
      "AcrySoft™",
      "Bases para Frances",
      "BUILDER GEL",
      "EXTENED GEL",
      "Gel Polish",
      "Glitters Gel Polish Profesional",
      "POLYGEL",
    ]);
    const gelPolish = proposal!.collections.find((m) => m.name === "Gel Polish")!;
    expect(gelPolish.handle).toBe("gel-polish");
    expect(gelPolish.sourceHandles).toHaveLength(9);
    expect(gelPolish.productHandles).toEqual(["gp-az", "gp-bl", "gp-ca", "gp-mo", "gp-og", "gp-ro", "gp-rs", "gp-sa", "gp-ve"]);
    // Las que no se unieron conservan su handle.
    expect(proposal!.collections[0]).toMatchObject({ handle: "acrysoft", sourceHandles: ["acrysoft"] });
  });

  it("no une colecciones grandes ni cambia nada cuando no hay parecidas", () => {
    expect(
      proposeMergeByRules([
        c("esmaltes-rojos", "Esmaltes rojos", ["a", "b", "c", "d"]),
        c("esmaltes-azules", "Esmaltes azules", ["e", "f", "g", "h"]),
      ]),
    ).toBeNull();
    expect(proposeMergeByRules([c("tips", "Tips", ["a"]), c("limas", "Limas", ["b"])])).toBeNull();
    expect(proposeMergeByRules([c("solo", "Una sola", ["a"])])).toBeNull();
  });

  it("si ya existe una colección con el nombre del grupo, las absorbe", () => {
    const proposal = proposeMergeByRules([
      c("gel-polish", "Gel Polish", ["x1", "x2", "x3", "x4", "x5"]),
      c("gel-polish-azules", "Gel Polish Azules", ["a"]),
      c("gel-polish-rojos", "Gel Polish Rojos", ["r"]),
    ]);
    expect(proposal?.collections).toHaveLength(1);
    expect(proposal?.collections[0]).toMatchObject({ handle: "gel-polish", name: "Gel Polish", sourceHandles: ["gel-polish", "gel-polish-azules", "gel-polish-rojos"] });
    expect(proposal?.collections[0].productHandles).toEqual(["x1", "x2", "x3", "x4", "x5", "a", "r"]);
  });

  it("une las repetidas y no deja un nombre terminado en 'de'", () => {
    const proposal = proposeMergeByRules([
      c("kit-de-unas", "Kit de uñas", ["a"]),
      c("kit-de-pinceles", "Kit de pinceles", ["b"]),
      c("limas", "Limas", ["c"]),
      c("limas-2", "LIMAS", ["d"]),
    ]);
    expect(proposal?.collections.map((m) => m.name)).toEqual(["Kit", "Limas"]);
    expect(proposal?.collections[1].sourceHandles).toEqual(["limas", "limas-2"]);
  });
});

describe("sanitizeMergeProposal", () => {
  it("ignora handles inventados, no repite originales y conserva lo que la IA dejó por fuera", () => {
    const proposal = sanitizeMergeProposal(
      [
        { name: "Gel Polish", sourceHandles: ["gel-polish-azules", "gel-polish-rosados", "no-existe", "gel-polish-azules"] },
        { name: "Geles de construcción", sourceHandles: ["builder-gel", "extened-gel", "polygel"] },
        { name: "  ", sourceHandles: ["glitters"] },
      ],
      BEAUTY,
    );
    expect(proposal?.source).toBe("ia");
    const names = proposal!.collections.map((m) => m.name);
    expect(names.slice(0, 3)).toEqual(["Gel Polish", "Geles de construcción", "Glitters Gel Polish Profesional"]);
    expect(names).toContain("AcrySoft™");
    expect(names).toContain("Gel Polish Verdes");
    expect(proposal!.collections[0].sourceHandles).toEqual(["gel-polish-azules", "gel-polish-rosados"]);
    expect(proposal!.collections[1].handle).toBe("geles-de-construccion");
  });

  it("devuelve null si la IA deja todo igual", () => {
    expect(sanitizeMergeProposal(BEAUTY.map((x) => ({ name: x.name, sourceHandles: [x.handle] })), BEAUTY)).toBeNull();
  });

  it("un solo cambio de nombre sí cuenta como propuesta", () => {
    const proposal = sanitizeMergeProposal(
      BEAUTY.map((x) => ({ name: x.handle === "extened-gel" ? "Extended Gel" : x.name, sourceHandles: [x.handle] })),
      BEAUTY,
    );
    expect(proposal?.collections.find((m) => m.handle === "extened-gel")?.name).toBe("Extended Gel");
  });

  it("un grupo se queda con el handle de una original que ya lo tenía; si no, uno nuevo que no choque", () => {
    const keeps = buildMergeProposal(
      [{ name: "Limas", sourceHandles: ["limas", "limas-2"] }],
      [c("limas", "Limas gruesas", ["a"]), c("limas-2", "Limas finas", ["b"]), c("limas-3", "Limas", ["c"])],
      "ia",
    );
    expect(keeps?.collections.map((m) => m.handle)).toEqual(["limas", "limas-3"]);
    const fresh = buildMergeProposal(
      [{ name: "Limas", sourceHandles: ["limas-gruesas", "limas-finas"] }],
      [c("limas-gruesas", "Limas gruesas", ["a"]), c("limas-finas", "Limas finas", ["b"]), c("limas", "Limas y buffers", ["c"])],
      "ia",
    );
    expect(fresh?.collections.map((m) => m.handle)).toEqual(["limas-2", "limas"]);
  });
});

describe("menuForProposal", () => {
  const proposal = proposeMergeByRules(BEAUTY)!;
  const menu = [
    { label: "ACRYSOFT™", href: "/collections/acrysoft" },
    { label: "GEL POLISH ROSADOS", href: "https://tienda.com/collections/gel-polish-rosados" },
    { label: "GEL POLISH ROJOS Y AMARILLOS", href: "/collections/gel-polish-rojos" },
    { label: "POLYGEL", href: "/collections/polygel" },
    { label: "CONTACTO", href: "/pages/contacto" },
  ];

  it("deja un solo enlace por grupo, con el nombre del grupo y en mayúsculas si el menú lo está", () => {
    expect(menuForProposal(menu, proposal)).toEqual([
      { label: "ACRYSOFT™", href: "/collections/acrysoft" },
      { label: "GEL POLISH", href: "/collections/gel-polish" },
      { label: "POLYGEL", href: "/collections/polygel" },
      { label: "CONTACTO", href: "/pages/contacto" },
    ]);
  });

  it("respeta la escritura del menú cuando no es en mayúsculas", () => {
    const mixed = menu.map((m) => ({ ...m, label: m.label.charAt(0) + m.label.slice(1).toLowerCase() }));
    expect(menuForProposal(mixed, proposal)[1]).toEqual({ label: "Gel Polish", href: "/collections/gel-polish" });
  });

  it("lee el handle de un enlace relativo o completo", () => {
    expect(collectionHandleFromHref("/collections/gel-polish-azules?sort=x")).toBe("gel-polish-azules");
    expect(collectionHandleFromHref("https://t.com/collections/Tips/products/x")).toBe("tips");
    expect(collectionHandleFromHref("/pages/contacto")).toBeNull();
  });
});
