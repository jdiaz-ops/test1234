import { describe, expect, it } from "vitest";
import { buildSiblingGroups, detectProductFamilies, familyOf, inferFamilyAxis, splitBySeparator } from "@/lib/product-families";

const named = (names: string[]) => names.map((name, i) => ({ id: `p${i + 1}`, name }));
const shape = (families: ReturnType<typeof detectProductFamilies>) =>
  families.map((f) => ({ group: f.group, axes: f.axes, members: f.members.map((m) => `${m.name} → ${Object.entries(m.attrs).map(([k, v]) => `${k}=${v}`).join(", ")}`) }));

// Nombres reales de amglowspa.com (2026-10-18).
const AMGLOW = [
  "VELOTERAPIA CHOCOLATE 130GR",
  "VELOTERAPIA MARACUYA 50GR",
  "VELOTERAPIA SANDIA 50GR",
  "VELOTERAPIA SANDIA 130GR",
  "VELOTERAPIA FRUTOS ROJOS 30GR",
  "VELOTERAPIA SANDIA 30GR",
  "VELOTERAPIA UVA 30GR",
  "ACEITE DE CUTICULA CHOCOLATE 30ML",
  "ACEITE DE CUTICULA PIÑA 30ML",
  "ACEITE DE CUTICULA MARACUYA 30ML",
  "ACEITE DE CUTICULA COCO 30ML",
  "OLEO DE CALENDULA 120ML",
  "OLEO DE ROSAS 120ML",
  "LIMPIADOR DE UÑAS 120ML AROMA SANDIA",
  "LIMPIADOR DE UÑAS 250ML AROMA SANDIA",
  "LIMPIADOR DE UÑAS 120ML AROMA UVA",
  "CHOCOLATERAPIA 500ML",
  "CHOCOLATERAPIA 200ML",
  "CHOCOLATERAPIA 350ML",
  "DULCES EXFOLIANTES X 100 UNIDADES",
  "DULCES EXFOLIANTES X 50 UNIDADES",
  "BOMBA ARCOIRIS X 100 UND",
  "BOMBA ARCOIRIS X 24 UND",
  "BOMBA MEDIANA X 100 UND",
  "BOMBA MINI X 100 UND",
  "JELLY SPA 1000GR MANGO",
  "JELLY SPA 1000GR COCO",
  "JELLY SPA 500GR MANGO",
  "JELLY SPA 500GR COCO",
  "JELLY SPA 20 SERVICIOS AROMAS SURTIDOS (40 sobres)",
  "JELLY SPA 10 SERVICIOS AROMAS SURTIDOS (20 sobres)",
  "SHIMMER SPLASH SEDUTION 250ML",
  "SHIMMER SPLASH BOMBOMBUM 250ML",
  "SMOOTHIE EXFOLIANTE FRUTAL 500ML",
  "SMOOTHIE EXFOLIANTE FRUTAL DE 200ML",
  "REGENERADOR DE CUTICULA",
  "CERA PARA MANICURA 20GR",
];

describe("familias de productos por el nombre", () => {
  const families = detectProductFamilies(named(AMGLOW));
  const byGroup = (group: string) => families.find((f) => f.group === group);
  const attrsOf = (name: string) => families.flatMap((f) => f.members).find((m) => m.name === name)?.attrs;

  it("una sola palabra de base sirve cuando el resto es un aroma y un tamaño (VELOTERAPIA)", () => {
    const f = byGroup("VELOTERAPIA")!;
    expect(f.axes).toEqual(["Aroma", "Tamaño"]);
    expect(f.members).toHaveLength(7);
    expect(attrsOf("VELOTERAPIA SANDIA 50GR")).toEqual({ Aroma: "SANDIA", Tamaño: "50GR" });
    expect(attrsOf("VELOTERAPIA FRUTOS ROJOS 30GR")).toEqual({ Aroma: "FRUTOS ROJOS", Tamaño: "30GR" });
  });

  it("los aromas de un mismo tamaño no llevan eje de tamaño (ACEITE DE CUTICULA)", () => {
    const f = byGroup("ACEITE DE CUTICULA")!;
    expect(f.axes).toEqual(["Aroma"]);
    expect(f.members.map((m) => m.attrs.Aroma)).toEqual(["CHOCOLATE", "PIÑA", "MARACUYA", "COCO"]);
  });

  it("una base que termina en 'de' se corre ('OLEO' con CALENDULA / ROSAS)", () => {
    expect(byGroup("OLEO")?.members.map((m) => m.attrs)).toEqual([{ Aroma: "CALENDULA" }, { Aroma: "ROSAS" }]);
  });

  it("la palabra 'aroma' en el nombre separa el valor, y el tamaño del medio también cuenta", () => {
    const f = byGroup("LIMPIADOR DE UÑAS")!;
    expect(f.axes).toEqual(["Aroma", "Tamaño"]);
    expect(attrsOf("LIMPIADOR DE UÑAS 120ML AROMA SANDIA")).toEqual({ Aroma: "SANDIA", Tamaño: "120ML" });
  });

  it("solo tamaños (CHOCOLATERAPIA) y solo cantidades (DULCES)", () => {
    expect(byGroup("CHOCOLATERAPIA")?.axes).toEqual(["Tamaño"]);
    expect(byGroup("CHOCOLATERAPIA")?.members.map((m) => m.attrs.Tamaño)).toEqual(["500ML", "200ML", "350ML"]);
    expect(byGroup("DULCES EXFOLIANTES")?.members.map((m) => m.attrs)).toEqual([{ Cantidad: "100 UNIDADES" }, { Cantidad: "50 UNIDADES" }]);
  });

  it("BOMBA: la presentación (arcoiris, mediana, mini) y la cantidad son dos ejes de un mismo grupo", () => {
    const f = byGroup("BOMBA")!;
    expect(f.axes).toEqual(["Opción", "Cantidad"]);
    expect(attrsOf("BOMBA ARCOIRIS X 24 UND")).toEqual({ Opción: "ARCOIRIS", Cantidad: "24 UND" });
    expect(attrsOf("BOMBA MINI X 100 UND")).toEqual({ Opción: "MINI", Cantidad: "100 UND" });
    expect(byGroup("BOMBA ARCOIRIS")).toBeUndefined();
  });

  it("JELLY SPA: aromas por tamaño, tamaños por aroma, y los surtidos por cantidad, todo en un grupo", () => {
    const f = byGroup("JELLY SPA")!;
    expect(f.members).toHaveLength(6);
    expect(attrsOf("JELLY SPA 1000GR MANGO")).toEqual({ Aroma: "MANGO", Tamaño: "1000GR" });
    expect(attrsOf("JELLY SPA 20 SERVICIOS AROMAS SURTIDOS (40 sobres)")).toEqual({ Aroma: "SURTIDOS", Tamaño: "20 SERVICIOS 40 sobres" });
  });

  it("valores sin vocabulario con dos palabras de base quedan como 'Opción'; 'de 200ML' es un tamaño", () => {
    expect(byGroup("SHIMMER SPLASH")?.axes).toEqual(["Opción"]);
    expect(byGroup("SMOOTHIE EXFOLIANTE FRUTAL")?.members.map((m) => m.attrs.Tamaño)).toEqual(["500ML", "200ML"]);
  });

  it("lo que está solo no entra en ninguna familia", () => {
    expect(attrsOf("REGENERADOR DE CUTICULA")).toBeUndefined();
    expect(attrsOf("CERA PARA MANICURA 20GR")).toBeUndefined();
    expect(familyOf(named(AMGLOW), "p36")).toBeNull();
  });

  it("reconoce el guion de los productos separados por variantes; el tono se infiere del color en la base", () => {
    expect(shape(detectProductFamilies(named(["Gel Polish Verdes – Acida 15 ml", "Gel Polish Verdes – Toxica 15 ml", "Gel Polish Rosados – Princesa 15 ml", "Gel Polish Top coat"])))).toEqual([
      { group: "Gel Polish Verdes", axes: ["Tono"], members: ["Gel Polish Verdes – Acida 15 ml → Tono=Acida", "Gel Polish Verdes – Toxica 15 ml → Tono=Toxica"] },
    ]);
  });

  it("paréntesis, palabras clave y 'en' con un color", () => {
    expect(shape(detectProductFamilies(named(["Crema de manos (Rosas)", "Crema de manos (Coco)"])))).toEqual([
      { group: "Crema de manos", axes: ["Aroma"], members: ["Crema de manos (Rosas) → Aroma=Rosas", "Crema de manos (Coco) → Aroma=Coco"] },
    ]);
    expect(shape(detectProductFamilies(named(["Kimono de seda en rojo", "Kimono de seda en negro", "Crema en tubo"])))).toEqual([
      { group: "Kimono de seda", axes: ["Tono"], members: ["Kimono de seda en rojo → Tono=rojo", "Kimono de seda en negro → Tono=negro"] },
    ]);
    expect(splitBySeparator("Crema en tubo")).toBeNull();
  });

  it("con una sola palabra en común y valores que no son aroma, tono ni tamaño, no agrupa", () => {
    expect(detectProductFamilies(named(["Lima recta 100/180", "Lima banana 100/180", "Base coat", "Top coat", "Base rubber"]))).toEqual([]);
    expect(shape(detectProductFamilies(named(["Pincel liner 5 mm", "Pincel liner 7 mm", "Pincel oval 4"])))).toEqual([
      { group: "Pincel liner", axes: ["Tamaño"], members: ["Pincel liner 5 mm → Tamaño=5 mm", "Pincel liner 7 mm → Tamaño=7 mm"] },
    ]);
  });

  // Nombres reales de rumicol.com (2026-10-18).
  it("Rumi: lo que comparten al final también es base, 'x 100' es una cantidad y un número suelto es 'Número'", () => {
    const families = detectProductFamilies(
      named([
        "Colección candy cat eye",
        "Colección dark cat eye",
        "Colección french cat eye",
        "Colección nude building gel",
        "Colección glass navidad",
        "Soft Gel Coffin x 100",
        "Soft Gel Stiletto x 100",
        "Soft Gel Coffin x 240",
        "Soft Gel Stiletto x 240",
        "Dual System sandwich x240",
        "Dual System Mix x 144",
        "Gama azules 1",
        "Gama azules 2",
        "Uñas 009",
        "Uñas 010",
      ]),
    );
    const byGroup = (group: string) => families.find((f) => f.group === group);
    expect(byGroup("Colección cat eye")?.members.map((m) => m.attrs.Opción)).toEqual(["candy", "dark", "french"]);
    expect(byGroup("Soft Gel")?.axes).toEqual(["Opción", "Cantidad"]);
    expect(byGroup("Soft Gel")?.members.find((m) => m.name === "Soft Gel Coffin x 240")?.attrs).toEqual({ Opción: "Coffin", Cantidad: "240" });
    // Cambian de forma y de cantidad a la vez: un solo eje con todo el valor.
    expect(byGroup("Dual System")?.members.map((m) => m.attrs)).toEqual([{ Opción: "sandwich 240" }, { Opción: "Mix 144" }]);
    expect(byGroup("Gama azules")?.axes).toEqual(["Número"]);
    expect(byGroup("Uñas")?.axes).toEqual(["Número"]);
  });

  it("ejes por vocabulario", () => {
    expect(inferFamilyAxis(["S", "M", "XL"])).toBe("Talla");
    expect(inferFamilyAxis(["#1", "#2", "N° 3"])).toBe("Número");
    expect(inferFamilyAxis(["Rojo", "Azul", "Café"])).toBe("Tono");
    expect(inferFamilyAxis(["Lavanda", "Coco", "Café"])).toBe("Aroma");
    expect(inferFamilyAxis(["Té verde", "Frutos rojos"])).toBe("Aroma");
    expect(inferFamilyAxis(["Princesa", "Acida"])).toBe("Opción");
  });

  it("una 'familia' de más de 80 productos es una categoría, no se arma sola", () => {
    const many = named(Array.from({ length: 81 }, (_, i) => `Esmalte semipermanente color ${i + 1}`));
    expect(detectProductFamilies(many)).toEqual([]);
    expect(detectProductFamilies(many.slice(0, 80))).toHaveLength(1);
  });

  it("buildSiblingGroups: otros aromas del mismo tamaño y otros tamaños del mismo aroma", () => {
    const f = byGroup("VELOTERAPIA")!;
    const current = f.members.find((m) => m.name === "VELOTERAPIA SANDIA 50GR")!;
    const groups = buildSiblingGroups(f.group, current, f.members);
    expect(groups.map((g) => [g.axis, g.label, g.current, g.items.map((i) => i.attrs[g.axis])])).toEqual([
      ["Aroma", "VELOTERAPIA 50GR", "SANDIA", ["SANDIA", "MARACUYA"]],
      ["Tamaño", "VELOTERAPIA SANDIA", "50GR", ["50GR", "30GR", "130GR"]],
    ]);
    // Un producto separado por variantes (un solo eje) sigue igual.
    const split = [
      { id: "a", attrs: { Grupo: "Rosados", Tono: "Loca" } },
      { id: "b", attrs: { Grupo: "Rosados", Tono: "Reina" } },
      { id: "c", attrs: { Grupo: "Rosados", Tono: "Princesa" } },
    ];
    expect(buildSiblingGroups("Rosados", split[0], split).map((g) => [g.axis, g.items.map((i) => i.id)])).toEqual([["Tono", ["a", "c", "b"]]]);
  });
});
