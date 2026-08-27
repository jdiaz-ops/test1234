/// Normaliza un correo para guardarlo o compararlo — quita espacios y pasa
/// a minúsculas. Sin esto, "Nombre@Gmail.com" y "nombre@gmail.com" se tratan
/// como cuentas distintas en cualquier comparación exacta (findUnique) — o,
/// peor, la MISMA cuenta se vuelve inaccesible si alguien la registra (o un
/// admin la crea a mano) con una mayúscula distinta a la que después escribe
/// al iniciar sesión. El caso típico: el teclado del celular autocapitaliza
/// el primer carácter de un campo de texto vacío.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
