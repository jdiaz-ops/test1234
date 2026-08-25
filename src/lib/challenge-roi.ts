/// Frase automática solo para el caso claramente bueno (> 2x) — para los
/// rangos intermedio (1x-2x) y malo (< 1x) se deja que el número hable
/// solo, sin agregar un juicio que podría sonar como que "falló" cuando
/// simplemente no rindió tanto.
export function roiComment(roi: number | null): string | null {
  if (roi != null && roi > 2) return "Esta campaña rindió bien — vale la pena repetirla.";
  return null;
}

export function formatROI(roi: number | null): string {
  return roi != null ? `${roi.toFixed(1)}x` : "—";
}

/// Con pocas órdenes, el ROI puede salir muy alto o muy bajo por pura
/// casualidad — no porque la campaña haya funcionado o no. Se avisa en vez
/// de escondérselo del todo.
export const ROI_SMALL_SAMPLE_THRESHOLD = 5;
