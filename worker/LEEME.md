# Backend del CP Club (Cloudflare Worker + D1)

Estado (2026-11-18): **desplegado en un Worker de PRUEBAS** (`cp-club-test`, https://cp-club-test.andresgarcia2964.workers.dev), separado del sitio real, con su base D1 `cp-club` y datos falsos. 38 pruebas locales + prueba de humo remota (`test/smoke-remote.mjs`) pasan; las páginas ya usan la API real (la de demo solo con `?demo=1`). **Falta:** el token de Toteat (`TOTEAT_*`), verificar los 4 supuestos con datos reales, contrato de datos, y la migración a la cuenta de Cuatro Paredes. Inventario de lo creado: `club-de-puntos/02_migracion-de-cuenta.md`.

> **MIGRAR AL ENTREGAR.** Por ahora (pruebas) el Club vive en la cuenta de Cloudflare `andresgarcia2964` (la misma del sitio). Al entregar se migra todo a una cuenta de Cuatro Paredes S.A.S.: pasos y riesgos en `club-de-puntos/02_migracion-de-cuenta.md`.

## Piezas
| Archivo | Qué hace |
|---|---|
| `index.js` | Rutas `/api/club/*` (cliente), `/api/caja/*` (cajero con PIN), `/api/admin/*` (solo con `ADMIN_TOKEN`) y el cron de cada minuto |
| `toteat.js` | Pide `GET /sales` a Toteat cada minuto (ventana de 3 días) y convierte los pagos en puntos; idempotente por `paymentId` |
| `rules.js` | Reglas aprobadas (1 punto por $1.000, +30 combo, +30 bienvenida, tope 250 por orden, vence a 90 días) |
| `auth.js` | PIN con pimienta, sesiones firmadas de 12 h y límite de intentos |
| `schema.sql` | Tablas: `customers`, `ledger` (libro de puntos), `sales_seen`, `codes`, `staff`, `kv`, `hits` |
| `test/run.mjs` | 38 pruebas de punta a punta (ventas → puntos → canje → caja) |
| `test/fake-toteat.mjs` | Toteat falso para probar la sincronización |

## Probar en local
```bash
rm -rf .wrangler/state
npx wrangler d1 execute cp-club --local --file worker/schema.sql -c wrangler.club.jsonc
npx wrangler dev -c wrangler.club.jsonc --local --port 8790
node worker/test/run.mjs http://localhost:8790
```
`.dev.vars` tiene claves **falsas** solo para esto (no se sube a git).

## Reglas de negocio que el servidor aplica
- **Sin puntos retroactivos:** la primera sincronización marca el inicio del Club (`club_start`); lo cerrado antes no suma.
- **Qué suma:** `payed − propina − costo de domicilio (TOTEATDVYCOST) − lo pagado con convenio/cuenta corriente`. Combos por nombre (`combo`; `para dos/varios` valen +60).
- **Notas de crédito** (`fiscalType NC`, montos negativos) restan puntos (sin bonus de combo).
- **Canje:** un solo código activo por celular; se reserva con un único `INSERT` condicionado y se entrega con una transacción (`batch`): reclamar código + descontar + registrar en el libro.
- **Vencimiento:** los puntos vencen en bloque a los 90 días de la última compra; queda registrado como movimiento `expire`.

## Supuestos verificados con la primera llamada real a Toteat (2026-11-17, 65 pagos de 3 días)
1. ✅ **`payed` incluye la propina:** en 15 de los 16 pagos con propina, `payed = total + propina`. (El caso restante se ve a medida que haya más datos.)
2. ✅ **(muy probable) `/sales` trae el turno abierto:** la última venta llegó 4 minutos antes de la consulta y el local estaba abierto.
3. ❌→✅ **El celular NO viene en `client.phones[]` como dice la documentación: viene en `client.phone` (texto).** Era un error que habría dejado el Club sin puntos. Corregido (`phonesOf` acepta `phone`, `phones` y `phoneNumber`) y con prueba. Formas reales vistas: 10 dígitos (`3XXXXXXXXX`) y 12 dígitos con prefijo `57`; las dos se normalizan bien.
4. ✅ **Costo de domicilio:** el campo de la API se llama `TOTEATDVYCOST` (visto en la configuración de la API). No hubo domicilios en esa ventana para comprobarlo en una venta.
5. **Adopción hoy:** solo **18 de 65 pagos (28 %)** traen cliente con celular; hoy el celular ya es obligatorio al crear un cliente nuevo, pero el cajero igual debe asociar el cliente a cada venta.
6. No hubo notas de crédito (`NC`) ni pagos con convenio en la ventana: esas reglas siguen probadas solo con ventas de ejemplo.

Diagnóstico sin datos personales (solo conteos): `POST /api/admin/diag-sales` con el `ADMIN_TOKEN`. El estado `GET /api/admin/health` muestra además la longitud (no el valor) de cada credencial de Toteat.

## Para desplegar (cuenta de pruebas `andresgarcia2964`; MIGRAR al entregar)
1. Crear la base: `wrangler d1 create cp-club` y poner el `database_id` en `wrangler.jsonc`; aplicar `schema.sql` en remoto.
2. Fusionar en `wrangler.jsonc`: `main`, `d1_databases`, `triggers.crons`, `assets.binding` y `assets.run_worker_first: ["/api/*"]` (ver `wrangler.club.jsonc`).
3. Secretos (los ingresa quien administra la cuenta, nunca por chat ni por git): `wrangler secret put ADMIN_TOKEN`, `SESSION_SECRET`, `TOTEAT_XIR`, `TOTEAT_XIL`, `TOTEAT_XIU`, `TOTEAT_XAPITOKEN`.
4. Autorizar las cajas y fijar el PIN (no se registran personas, hay rotación):
   - Por cada tablet: `POST /api/admin/device-new {"name":"Caja 1"}` → devuelve un enlace secreto `/club/caja/?activar=…` que se abre UNA vez en esa tablet. `device-off {"name"}` lo desactiva; `devices` lista.
   - PIN único de la casa: `POST /api/admin/pin-set {"pin":"1234"}` (reemplaza el de todas las cajas). Las entregas quedan registradas con el nombre de la caja.
   - Corregir un cumpleaños mal guardado (en la web solo se guarda una vez): `POST /api/admin/birthday-set {"phone","mmdd":"MM-DD"}`.
   - (`staff` / `staff-off` siguen existiendo pero ya no hacen falta.)
5. Dirección pública: en `wrangler.club.jsonc`, `routes` manda solo `/club`, `/club/*`, `/api/club/*` y `/api/caja/*` del dominio al Worker (la ruta gana sobre el Custom Domain del sitio, que sigue en el Worker `cp`). Con rutas hay que dejar `"workers_dev": true` o wrangler apaga la URL de workers.dev (por ahí se administra: `/api/admin/*` no se publica en el dominio). Rollback: quitar `routes` y desplegar.
6. Si la base ya existía, la columna del cumpleaños se agrega así: `ALTER TABLE customers ADD COLUMN birthday_set_at INTEGER` (`schema.sql` solo crea tablas nuevas).
7. Conectar `club/js/http-api.js` en las páginas y quitar el modo de prueba del público.
