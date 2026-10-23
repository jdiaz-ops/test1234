import { afterEach, describe, expect, it, vi } from "vitest";
import { rememberFor } from "@/lib/remember-for";

describe("rememberFor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("consulta una vez por clave mientras dura el minuto, y otra vez después", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async (slug: string) => ({ slug }));
    const find = rememberFor(60_000, load);
    // Las visitas que llegan a la vez comparten la misma consulta.
    const [a, b] = await Promise.all([find("bella"), find("bella")]);
    expect(a).toBe(b);
    await find("otra");
    expect(load).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(59_000);
    await find("bella");
    expect(load).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2_000);
    await find("bella");
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("no recuerda errores, ni nada con 0, y bota las claves más viejas", async () => {
    let fail = true;
    const load = vi.fn(async (key: string) => {
      if (fail) throw new Error("base caída");
      return key;
    });
    const find = rememberFor(60_000, load, 2);
    await expect(find("x")).rejects.toThrow("base caída");
    fail = false;
    expect(await find("x")).toBe("x");
    await find("y");
    await find("z");
    await find("x");
    expect(load).toHaveBeenCalledTimes(5);

    const never = vi.fn(async (key: string) => key);
    const off = rememberFor(0, never);
    await off("x");
    await off("x");
    expect(never).toHaveBeenCalledTimes(2);
  });
});
