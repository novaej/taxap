# Puesta en marcha

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 24.x |
| Docker | Para PostgreSQL local |
| PostgreSQL | 16+ (vía Docker) |

## 1. Base de datos

```bash
docker compose up -d
docker compose ps        # esperar a que aparezca "healthy"
```

Levanta PostgreSQL 16 en `localhost:5432`, con base `taxap_dev` y usuario `taxap`.

> **El usuario `taxap` no es superusuario, y no debe serlo.** Los superusuarios de
> PostgreSQL ignoran la Row-Level Security de forma incondicional, incluso con
> `FORCE ROW LEVEL SECURITY`. Un despliegue mal configurado que use el usuario
> `postgres` desactiva en silencio todo el aislamiento entre usuarios.
> Ver [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

Verificar que no lo es:

```bash
docker compose exec postgres psql -U taxap -d taxap_dev \
  -c "SELECT rolsuper FROM pg_roles WHERE rolname = current_user;"
# debe devolver: f
```

## 2. Variables de entorno

```bash
cp .example.env .env.local
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
npm run migrate
npm run db:seed     # tasas de IVA y mapa de casilleros
```

> El seed carga datos normativos marcados como no verificados
> ([`docs/tax/`](docs/tax/)). **No usar para cálculos reales hasta completar la
> verificación.**

## 4. Arrancar

```bash
npm run dev
```

http://localhost:3000

## Verificación de que la RLS funciona

No es opcional. Antes de construir sobre esta base:

```bash
npm run test:rls
```

Crea dos usuarios con contribuyentes distintos y comprueba que ninguno ve los datos
del otro, ni siquiera consultando por identificador directo. **Si esta prueba no
pasa, el aislamiento entre clientes no existe.**

## Datos de prueba

Los archivos `.txt` del SRI **no se versionan** — son datos tributarios reales.
Colocarlos en `samples/`, que está en `.gitignore`.

Para el formato esperado, ver
[`docs/tax/formato-archivos-sri.md`](docs/tax/formato-archivos-sri.md).

## Problemas frecuentes

**`connection refused` en el puerto 5432.** Hay otro PostgreSQL local ocupando el
puerto. Detenerlo o cambiar el mapeo en `docker-compose.yml`.

**Las consultas devuelven datos de otros usuarios.** El usuario de base de datos es
superusuario, o el código está consultando fuera del envoltorio que fija
`app.current_user_id`. Ver [ADR-004](docs/adr/004-rls-por-usuario-con-prisma.md).

**Las consultas no devuelven nada estando los datos ahí.** `app.current_user_id`
está fijada con un valor que no corresponde, o la transacción envolvente no está
abierta.
