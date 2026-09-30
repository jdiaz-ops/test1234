import { defineConfig } from "vitest/config";
import path from "node:path";

/// Pruebas automáticas. `npm test` corre las de cálculos (sin base de
/// datos). `npm run test:db` corre además las de base de datos contra una
/// base de PRUEBA (TEST_DATABASE_URL), nunca contra la real: ver
/// tests/integration/setup.ts.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // Las de base de datos comparten tablas: una a la vez.
    fileParallelism: false,
    testTimeout: 20000,
    // Los correos simulados (sin llave de Resend) llenan la salida: se
    // ocultan en las pruebas.
    onConsoleLog: (log) => !log.includes("[email simulado]"),
  },
});
