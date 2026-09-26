# Puesta en marcha

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 24.x |
| Docker | Para PostgreSQL local |
| PostgreSQL | 18+ (vía Docker) |

## 1. Base de datos

El contenedor se llama `postgres18`. Si ya existe, solo arrancarlo:

```bash
docker start postgres18
```

Si no existe todavía, crearlo:

```bash
docker run -d \
  --name postgres18 \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:18-alpine
```

Crear el usuario `taxap` y la base `taxap_dev`:

```bash
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
```

> **El usuario `taxap` no es superusuario, y no debe serlo.** Los superusuarios de
> PostgreSQL ignoran la Row-Level Security de forma incondicional, incluso con
> `FORCE ROW LEVEL SECURITY`. Un despliegue mal configurado que use el usuario
> `postgres` desactiva en silencio todo el aislamiento entre usuarios.
> Ver [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

Verificar que no lo es:

```bash
docker exec postgres18 psql -U taxap -d taxap_dev \
  -c "SELECT rolsuper FROM pg_roles WHERE rolname = current_user;"
# debe devolver: f
```

Más detalle (reinicio desde cero, credenciales, acceso via `psql`/Prisma Studio)
en [`docs/LOCAL-DEVELOPMENT.md`](docs/LOCAL-DEVELOPMENT.md).

## 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Generar el secreto de autenticación:

```bash
openssl rand -base64 32
```

`ANTHROPIC_API_KEY` es **opcional**. Sin ella, el sistema funciona en modo sin IA:
la cascada corre los niveles 1, 2 y 4, y más comprobantes caen a la bandeja de
revisión. Nada se rompe. Ver [ADR-007](docs/adr/007-modo-sin-ia-y-catalogo-compartido.md).

## 3. Dependencias y esquema

```bash
npm install
export $(cat .env.local | xargs)
npm run db:migrate
```

> No hay seed de datos normativos todavía (tasas de IVA, mapa de casilleros).
> Cargarlos manualmente por ahora — ver [`docs/tax/`](docs/tax/). Cualquier valor
> sin fuente y fecha de verificación va marcado `[VERIFICAR]` y **no se carga al
> sistema** (ver CLAUDE.md, "Valores normativos").

## 4. Arrancar

```bash
npm run dev
```

http://localhost:3000

## Verificación de que la RLS funciona

No es opcional. Antes de construir sobre esta base, confirmar que **ambas**
banderas están activas en cada tabla con datos de contribuyentes — `ENABLE ROW
LEVEL SECURITY` sola no alcanza si la app se conecta con el mismo rol que es
dueño de las tablas (que es el caso aquí: `taxap` corre las migraciones y
también sirve las consultas). Sin `FORCE`, Postgres exime al dueño de sus
propias políticas y las consultas devuelven todo sin filtrar, en silencio:

```bash
docker exec postgres18 psql -U postgres -d taxap_dev -c "
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
  WHERE relname IN (
    'taxpayers', 'tax_periods', 'source_files', 'invoices_received',
    'invoices_issued', 'supplier_rules', 'classification_events', 'period_results'
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
> la verificación de tenant-aislamiento se hizo ad hoc y no quedó como
> artefacto reproducible. Escribir uno antes de tocar `src/lib/db.ts` de nuevo.

## Datos de prueba

Los archivos `.txt` del SRI **no se versionan** — son datos tributarios reales.
Colocarlos en `samples/`, que está en `.gitignore`.

Para el formato esperado, ver
[`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).

## Problemas frecuentes

**`connection refused` en el puerto 5432.** Hay otro PostgreSQL local ocupando el
puerto. Revisar qué hay corriendo con `docker ps` antes de crear un contenedor
nuevo — probablemente ya existe uno que se puede reutilizar.

**Las consultas devuelven datos de otros usuarios.** El usuario de base de datos es
superusuario, falta `FORCE ROW LEVEL SECURITY` en la tabla, o el código está
consultando fuera del envoltorio que fija `app.current_user_id`.
Ver [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

**Las consultas no devuelven nada estando los datos ahí.** `app.current_user_id`
está fijada con un valor que no corresponde, o la transacción envolvente no está
abierta — `withUser()` debe correr el `SET` y la consulta dentro del mismo
`$transaction`, nunca como llamadas separadas contra una conexión pooled.
