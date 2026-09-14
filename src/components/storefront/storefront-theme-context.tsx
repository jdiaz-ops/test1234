"use client";

import { createContext, useContext } from "react";
import { DEFAULT_THEME_CONFIG, type ThemeConfig } from "@/lib/brand-theme";

/// Expone el tema publicado (colores, tipografía, encabezado, etc.) a los
/// componentes cliente de la vitrina sin tener que pasarlo como prop por
/// cada página — se arma una sola vez en el layout de /t/[slug] (ver
/// StorefrontLayout) y de ahí lo consume, por ejemplo, StoreHeader. Los
/// colores/tipografía/CSS en sí se aplican con variables CSS en el
/// wrapper del layout (no hace falta JS para eso) — este contexto es
/// solo para los valores que sí necesitan una decisión en JS (ej. dónde
/// va el logo, si el encabezado es sticky).
const StorefrontThemeContext = createContext<ThemeConfig>(DEFAULT_THEME_CONFIG);

export function StorefrontThemeProvider({
  theme,
  children,
}: {
  theme: ThemeConfig;
  children: React.ReactNode;
}) {
  return (
    <StorefrontThemeContext.Provider value={theme}>
      {children}
    </StorefrontThemeContext.Provider>
  );
}

export function useStorefrontTheme(): ThemeConfig {
  return useContext(StorefrontThemeContext);
}
