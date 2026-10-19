-- Términos y política de datos: aliados comerciales (2026-10-19).
--
-- Marcolini va a tener aliados comerciales que presentan marcas y
-- creadores y ganan una comisión calculada sobre sus ventas, pagada de la
-- tarifa de Marcolini. Las marcas y los creadores no ven al aliado en la
-- plataforma, así que queda dicho en los términos y en la política de
-- datos (Ley 1581 de 2012) qué recibe el aliado y qué no.
--
-- El contenido legal vive en la base (Admin → Configuración → Contenido
-- legal). Estos cambios son quirúrgicos: agregan la sección nueva y
-- corren la numeración sobre los títulos que ya existen, sin pisar lo que
-- el admin haya escrito. Si algún título no está (el texto se editó) o la
-- sección ya existe, no se toca nada y se agrega a mano desde el admin.

-- Términos: sección 7 nueva antes de "Reembolsos"; las siguientes corren
-- un número.
UPDATE "LegalContent"
SET "body" = replace(
      replace(
        replace(
          replace(
            replace(
              replace("body", 'Última actualización: 26 de agosto de 2026', 'Última actualización: 19 de octubre de 2026'),
              E'\n11. Contacto\n', E'\n12. Contacto\n'),
            E'\n10. Cambios a estos términos\n', E'\n11. Cambios a estos términos\n'),
          E'\n9. Cancelación\n', E'\n10. Cancelación\n'),
        E'\n8. Responsabilidad sobre el contenido\n', E'\n9. Responsabilidad sobre el contenido\n'),
      E'\n7. Reembolsos\n',
      E'\n7. Aliados comerciales\n\n'
      || E'Marcolini puede trabajar con aliados comerciales: personas o empresas que presentan marcas y creadores para que se unan a la plataforma. Para ser aliado comercial se necesita la aprobación de Marcolini y firmar su acuerdo de aliado.\n\n'
      || E'Si llegaste a Marcolini por medio de un aliado, Marcolini le puede pagar a ese aliado una comisión calculada sobre las ventas que se hagan en la plataforma con tu marca o con tus enlaces y códigos de creador, durante un tiempo limitado. Esa comisión sale de la tarifa de Marcolini: no cambia la tarifa que paga la marca ni la comisión que recibe el creador.\n\n'
      || E'El aliado no tiene acceso a tu cuenta, a tus pedidos ni a los datos de tus clientes. Para calcular y pagar su comisión, Marcolini solo le informa el nombre de la marca o del creador que presentó y los totales de ventas por período.\n\n'
      || E'Los aliados comerciales no son empleados, agentes ni representantes de Marcolini, y no pueden hacer promesas ni acuerdos en su nombre.\n\n'
      || E'8. Reembolsos\n'),
    "updatedAt" = NOW()
WHERE "key" = 'terms'
  AND strpos("body", 'Aliados comerciales') = 0
  AND strpos("body", E'\n7. Reembolsos\n') > 0
  AND strpos("body", E'\n8. Responsabilidad sobre el contenido\n') > 0
  AND strpos("body", E'\n9. Cancelación\n') > 0
  AND strpos("body", E'\n10. Cambios a estos términos\n') > 0
  AND strpos("body", E'\n11. Contacto\n') > 0;

-- Política de datos: qué se recoge del formulario de ingreso y de los
-- aliados, para qué, y qué ve el aliado.
UPDATE "LegalContent"
SET "body" = replace(
      replace(
        replace(
          replace(
            replace(
              replace("body", 'Última actualización: 26 de agosto de 2026', 'Última actualización: 19 de octubre de 2026'),
              'como cookies de sesión, necesarios para mantenerte conectado a tu cuenta.',
              'como cookies de sesión, necesarios para mantenerte conectado a tu cuenta. Si llenas una solicitud para unirte a Marcolini, por ejemplo desde el enlace de un aliado comercial, guardamos los datos del formulario (nombre, celular, redes sociales, ciudad o nombre de tu marca) y el enlace por el que llegaste. Si eres aliado comercial: tu nombre o razón social, número de documento, teléfono, correo y los datos de tu cuenta bancaria, que necesitamos para pagarte tus comisiones.'),
            'Para pagarte (si eres creador) o cobrarte (si eres marca)',
            'Para pagarte (si eres creador o aliado comercial) o cobrarte (si eres marca)'),
          'Para comunicarnos contigo sobre tu cuenta, tus ventas y cambios en la plataforma.',
          'Para comunicarnos contigo sobre tu cuenta, tus ventas y cambios en la plataforma. Para revisar las solicitudes de ingreso y para calcular y pagar las comisiones de los aliados comerciales.'),
        'con ePayco, para procesar el pago de tus comisiones (si eres creador);',
        'con ePayco, para procesar el pago de tus comisiones (si eres creador o aliado comercial);'),
      'solo los usamos internamente para procesar el pago; y cuando la ley nos lo exija.',
      'solo los usamos internamente para procesar el pago; con el aliado comercial que te presentó a Marcolini, si lo hay, que solo puede ver tu nombre o el de tu marca y los totales de tus ventas por período, sin el detalle de los pedidos ni los datos de tus clientes, para calcular y pagar su comisión; y cuando la ley nos lo exija.'),
    "updatedAt" = NOW()
WHERE "key" = 'privacy'
  AND strpos("body", 'aliado comercial') = 0
  AND strpos("body", 'como cookies de sesión, necesarios para mantenerte conectado a tu cuenta.') > 0
  AND strpos("body", 'Para comunicarnos contigo sobre tu cuenta, tus ventas y cambios en la plataforma.') > 0
  AND strpos("body", 'solo los usamos internamente para procesar el pago; y cuando la ley nos lo exija.') > 0;
