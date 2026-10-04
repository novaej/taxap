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

| Parámetro | Valor |
|---|---|
| Host | `localhost` |
| Puerto | `5432` |
| Usuario | `taxap` |
| Contraseña | `taxap_dev_password` |
| Base | `taxap_dev` |

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

El `taxap` role tiene permiso `CREATEDB` (lo necesita Prisma para la shadow
database durante las migraciones) pero no es superusuario.

## 2. Variables de entorno

```bash
cp .env.local.example .env.local
```

Generar el secreto de autenticación:

```bash
openssl rand -base64 32
```

`.env.local` queda así (no se versiona):

```
DATABASE_URL="postgresql://taxap:taxap_dev_password@localhost:5432/taxap_dev?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<el secreto generado arriba>"
ANTHROPIC_API_KEY=""
```

`ANTHROPIC_API_KEY` es **opcional**. Sin ella, el sistema funciona en modo sin IA:
la cascada corre los niveles 1, 2 y 4, y más comprobantes caen a la bandeja de
revisión. Nada se rompe. Ver [ADR-007](docs/adr/007-modo-sin-ia-y-catalogo-compartido.md).

## 3. Dependencias y esquema

```bash
npm install
npm run db:migrate
npm run db:seed
```

El seed (`prisma/seed.ts`) solo carga los planes (`plans`) — hacen falta para
que `users.plan_code` tenga a qué apuntar al registrar una cuenta. **No carga
datos normativos** (tasas de IVA, mapa de casilleros): cualquier valor sin
fuente y fecha de verificación va marcado `[VERIFICAR]` y no se carga al
sistema (CLAUDE.md → "Valores normativos"). Esos se cargan manualmente cuando
se verifiquen — ver [`docs/tax/`](docs/tax/).

## 4. Arrancar

```bash
npm run dev
```

http://localhost:3000 → redirige a `/es` (único locale por ahora).

## 5. Recorrido completo, de cero a pre-declaración

Todo lo de aquí en adelante pasa dentro de la aplicación — ninguna URL se
teclea a mano más allá de la inicial.

1. **Registro y login.** Entrar a `http://localhost:3000` redirige a
   `/es/login` (sin sesión). Ir a `/es/register`, crear la cuenta, volver a
   iniciar sesión. Con sesión, la portada redirige a `/es/taxpayers`.
2. **Crear un contribuyente.** En `/es/taxpayers` (vacío la primera vez),
   botón "Registrar el primero" → formulario: RUC (13 dígitos), razón
   social, régimen, periodicidad de IVA y actividades económicas. El MVP
   solo calcula pre-declaración para periodicidad **mensual**; con otra
   periodicidad el contribuyente queda registrado pero sin cálculo
   todavía.
3. **Crear un período.** Al crear el contribuyente, vuelve a la lista;
   "Ver períodos →" lleva a `/es/[taxpayerId]/periodos`. Ahí, "+ Nuevo
   período" y elegir año/mes. Cada período queda en estado "Borrador".
4. **Entrar al período.** Un clic en el período creado lleva a su pantalla
   raíz (pre-declaración), con enlaces a las tres pantallas del flujo:
   - **Ingesta** — cargar un archivo `.txt` de comprobantes (recibidos u
     emitidos) del SRI. Ver formato esperado en
     [`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).
   - **Ventas emitidas** — marcar el destino de las ventas con `IVA = 0%`
     (exportación, 0% con/sin derecho a crédito, no objeto/exenta). El
     factor de proporcionalidad no se calcula mientras quede alguna sin
     marcar.
   - **Conciliación** — clasificar las compras con `IVA > 0` (crédito
     tributario, costo o gasto, o excluir), por proveedor.
5. **Pre-declaración.** De vuelta en la raíz del período, los resultados
   calculados (sin casillero del formulario todavía, ver
   [`NEXT_STEPS.md`](NEXT_STEPS.md)) y la opción de marcar el período como
   declarado.

Para el detalle de qué hace cada Server Action y por qué, ver
[`docs/guides/code-flow.md`](docs/guides/code-flow.md). Para errores
durante este recorrido, ver [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

## 6. Administración (opcional)

Para subir el formulario 104 o cargar una tasa de IVA hace falta una
cuenta `ADMIN` — el registro normal (paso 1) siempre crea cuentas
`INDIVIDUAL`.

```bash
npm run seed:admin -- correo@ejemplo.com "contraseña-segura"
```

Si `correo@ejemplo.com` ya existe (por ejemplo, la cuenta que usaste en
el paso 1), el comando la promueve a `ADMIN` sin pedir contraseña. Inicia
sesión con esa cuenta y el menú lateral va a mostrar "Administración".

En `/admin/formularios`, "Nueva versión" sube un PDF -- solo para
calcular su huella, no se guarda -- y crea un borrador. Ahí se agregan
los casilleros a mano (no hay extracción automática del PDF todavía) y
se publica. En `/admin/tasas`, cargar una tasa exige su fuente y fecha de
verificación; no hay ninguna cargada por defecto porque ninguna está
verificada todavía (`docs/tax/tasas-iva.md`).

## Comandos de base de datos

| Comando | Qué hace |
|---|---|
| `npm run db:migrate` | Aplica migraciones pendientes (`prisma migrate dev`) |
| `npm run db:seed` | Siembra los planes (`prisma/seed.ts`) |
| `npm run db:reset` | Borra todo en `public` (tablas, tipos, funciones) y vuelve a migrar + sembrar. Bloqueado si `NODE_ENV=production`. |
| `npm run seed:admin -- <correo> [contraseña]` | Crea o promueve una cuenta a `ADMIN` |

Acceso directo a la base, si hace falta:

```bash
# Como el usuario de la app
PGPASSWORD="taxap_dev_password" psql -h localhost -U taxap -d taxap_dev

# Como superusuario (para tareas administrativas, nunca para la app)
docker exec postgres18 psql -U postgres -d taxap_dev

# Prisma Studio
npx prisma studio
```

## Datos de prueba

Los archivos `.txt` del SRI **no se versionan** — son datos tributarios reales.
Colocarlos en `samples/`, que está en `.gitignore`.

Para el formato esperado, ver
[`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).

## Resetear desde cero

```bash
npm run db:reset
```

Equivalente manual si hiciera falta:

```bash
docker exec postgres18 psql -U postgres -c "DROP DATABASE taxap_dev;"
./scripts/setup-db.sh postgres18 taxap "taxap_dev_password"
npm run db:migrate
npm run db:seed
```

Para verificar que la RLS funciona y para errores comunes durante la puesta
en marcha o el recorrido, ver [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
