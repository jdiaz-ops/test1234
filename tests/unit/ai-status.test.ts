import { afterEach, describe, expect, it } from "vitest";
import { checkAiStatus, describeAiError } from "@/server/services/ai-status-service";
import { GET as salud } from "@/app/api/salud/route";

const previous = process.env.ANTHROPIC_API_KEY;

describe("estado de la IA", () => {
  afterEach(() => {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  });

  it("sin llave lo dice sin llamar a nada", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await checkAiStatus()).toMatchObject({ configured: false, keyValid: null, credit: null, latencyMs: null });
    expect(await (await salud()).json()).toMatchObject({ ok: true, ia: false });
  });

  it("la señal pública solo dice si la llave está, nunca cuál es", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-prueba";
    const body = await (await salud()).json();
    expect(body).toMatchObject({ ok: true, ia: true });
    expect(JSON.stringify(body)).not.toContain("sk-ant");
  });

  it("traduce los errores de la API", () => {
    expect(describeAiError(Object.assign(new Error("invalid x-api-key"), { status: 401 }))).toMatchObject({ keyValid: false, credit: null });
    expect(describeAiError(Object.assign(new Error("Your credit balance is too low"), { status: 400 }))).toMatchObject({ keyValid: true, credit: false });
    expect(describeAiError(Object.assign(new Error("rate limited"), { status: 429 }))).toMatchObject({ keyValid: true, credit: true });
    expect(describeAiError(Object.assign(new Error("overloaded"), { status: 529 }))).toMatchObject({ keyValid: true, credit: null });
    expect(describeAiError(new Error("fetch failed"))).toMatchObject({ keyValid: null, credit: null });
  });
});
