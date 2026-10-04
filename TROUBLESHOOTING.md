# Problemas frecuentes

Para la puesta en marcha paso a paso, ver [`GETTING_STARTED.md`](GETTING_STARTED.md).

## Base de datos

**`connection refused` en el puerto 5432.** Hay otro PostgreSQL local ocupando el
puerto. Revisar qué hay corriendo con `docker ps` antes de crear un contenedor
nuevo — probablemente ya existe uno que se puede reutilizar.

**El registro falla / `plan_code` no tiene a qué apuntar.** No se corrió
`npm run db:seed`. `users.plan_code` es una FK a `plans.code`.

## Row-Level Security (RLS)

**Verificación de que la RLS funciona.** No es opcional. Antes de construir
sobre esta base, confirmar que **ambas** banderas están activas en cada
tabla con datos de contribuyentes — `ENABLE ROW LEVEL SECURITY` sola no
alcanza si la app se conecta con el mismo rol que es dueño de las tablas
(que es el caso aquí: `taxap` corre las migraciones y también sirve las
consultas). Sin `FORCE`, Postgres exime al dueño de sus propias políticas y
las consultas devuelven todo sin filtrar, en silencio:

```bash
docker exec postgres18 psql -U postgres -d taxap_dev -c "
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  WHERE relname IN (
    'taxpayers', 'user_taxpayers', 'tax_periods', 'source_files',
    'invoices_received', 'invoices_issued', 'supplier_rules',
    'classification_events', 'period_results'
  );
"
# las tres columnas deben ser 't' en cada fila
```

Con datos de dos contribuyentes distintos, confirmar que un usuario no ve los
del otro ni siquiera pasando el identificador directo — el envoltorio en
[`src/lib/db.ts`](src/lib/db.ts) (`withUser`/`asAdmin`) es el único camino
permitido para tocar estas tablas. **Si esta prueba no pasa, el aislamiento
entre clientes no existe.** Ver [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

> Pendiente: no hay todavía un script de regresión permanente para esto —
> cada verificación se hizo ad hoc y no quedó como artefacto reproducible.
> Ver [`NEXT_STEPS.md`](NEXT_STEPS.md).

**Las consultas devuelven datos de otros usuarios.** El usuario de base de datos es
superusuario, falta `FORCE ROW LEVEL SECURITY` en la tabla, o el código está
consultando fuera del envoltorio que fija `app.current_user_id`.
Ver [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

**Las consultas no devuelven nada estando los datos ahí.** `app.current_user_id`
está fijada con un valor que no corresponde, o la transacción envolvente no está
abierta — `withUser()` debe correr el `SET` y la consulta dentro del mismo
`$transaction`, nunca como llamadas separadas contra una conexión pooled.

**Un `DELETE` sobre `taxpayers` falla con "record not found" aunque el `SELECT`
en la misma transacción sí ve la fila.** No es un bug de RLS: la tabla
`taxpayers` solo tiene políticas para `SELECT`/`INSERT`/`UPDATE`
(`prisma/migrations/*_add_rls/migration.sql`), ningún `DELETE` — ni siquiera
para `is_system_admin()`. Con `FORCE ROW LEVEL SECURITY`, la ausencia de
política para un comando bloquea ese comando por completo para cualquier
fila, no lo filtra a cero filas visibles. Es deliberado: un contribuyente no
se borra desde la aplicación. Si hace falta borrar uno en desarrollo, se
hace a mano con el rol superusuario de Postgres (nunca con el rol `taxap`).

**Ni siquiera el superusuario puede borrar una fila de `classification_events`.**
A diferencia de lo anterior, esto no es RLS (que el superusuario sí ignora) —
es un disparador real, `reject_classification_event_mutation()`
(`prisma/migrations/20260930113100_add_rls/migration.sql`, ADR-013), que
rechaza incondicionalmente cualquier `DELETE`/`UPDATE` sobre esa tabla para
cualquier rol. Un `taxPeriod` con al menos un evento registrado
(cualquier cambio de estado: `lockPeriod`, `reopenPeriod`, el nuevo
`updatePeriodStatus`) queda, por lo tanto, permanentemente imborrable, y con
él su `taxpayer`. Es intencional — la bitácora es append-only de verdad, no
solo "difícil de editar desde la app" — pero importa saberlo antes de sembrar
datos de prueba contra la base real: cualquier dato que dispare un evento de
clasificación no se puede limpiar después, ni a mano. Para pruebas
descartables, evitar transiciones de estado sobre contribuyentes/períodos que
no se puedan dejar así para siempre.

## Fechas

**Una fecha guardada como `@db.Date` se muestra un día (o un mes) antes
de lo esperado.** Prisma lee un `@db.Date` de vuelta como medianoche
**UTC**, nunca medianoche local. En cualquier huso detrás de UTC (Ecuador,
UTC-5), formatear esa fecha con los getters de hora local
(`getMonth()`, `getFullYear()`, `toLocaleDateString()` sin `timeZone`)
retrocede un día — y si el día es 1, retrocede un mes entero. Pasó de
verdad con `tax_periods.period_start` (`periodos-client.tsx`) e
`invoices_issued.issue_date` (`ventas-table.tsx`): un período de agosto
se mostraba como julio. La regla: cualquier valor leído de una columna
`@db.Date` se muestra con los getters **UTC**
(`getUTCMonth`/`getUTCFullYear`/`getUTCDate`) o con
`toLocaleDateString(locale, { timeZone: 'UTC' })` — nunca con los
getters locales. Al construir uno de estos valores para guardarlo,
`Date.UTC(year, month, day)`, no `new Date(year, month, day)` (que
usa la zona del proceso que corre el código, no la del usuario).

## Rutas y sesión

**Una ruta protegida no redirige a `/login` sin sesión.** Revisar que el
archivo de proxy esté en `src/proxy.ts` (no en la raíz del proyecto ni
llamado `middleware.ts` — Next.js 16 renombró la convención; con un
directorio `src/`, solo reconoce `src/proxy.ts`). `src/proxy.ts` protege por
exclusión (todo requiere sesión salvo `/login`, `/register` y `/`): si una
ruta nueva queda pública sin querer, revisar `isPublicPath()` ahí, no una
lista de rutas protegidas que haya que mantener a mano.
