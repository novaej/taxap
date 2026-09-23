# ADR-004: Row-Level Security por usuario con Prisma

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

El aislamiento entre contribuyentes hoy dependería enteramente de que cada consulta
incluya su filtro. Una sola consulta que olvide el `WHERE` expone la contabilidad de
un cliente a otro — el peor fallo posible para este producto.

`comprobify` ya resolvió esto en PostgreSQL plano
(`comprobify/docs/adr/012-postgresql-row-level-security.md`): una variable de
configuración transaccional (`set_config('app.current_issuer_id', $1, true)`)
leída por las políticas, con `FORCE ROW LEVEL SECURITY` para que apliquen también
al dueño de la tabla.

La diferencia aquí es el ORM. `comprobify` usa `pg` crudo y controla cada
transacción. Prisma mantiene un pool y reutiliza conexiones: **una variable de
sesión fijada en una consulta puede filtrarse a la siguiente operación de otro
usuario.**

## Decisión

**RLS sobre `app.current_user_id`, fijada con `SET LOCAL` dentro de una transacción
interactiva de Prisma**, nunca a nivel de sesión.

Todo acceso a datos de contribuyentes pasa por un único envoltorio, algo como
`withUser(userId, fn)`, que abre transacción, fija la variable y ejecuta. No se
consulta una tabla protegida fuera de ese envoltorio.

Política para tablas con vínculo directo al usuario:

```sql
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxpayers FORCE ROW LEVEL SECURITY;

CREATE POLICY taxpayers_isolation ON taxpayers
  AS PERMISSIVE FOR ALL
  USING (
    NULLIF(current_setting('app.current_user_id', true), '') IS NULL
    OR EXISTS (
      SELECT 1 FROM user_taxpayers ut
      WHERE ut.taxpayer_id = taxpayers.id
        AND ut.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );
```

Las tablas hijas (`invoices_received`, `tax_periods`, …) usan una subconsulta
equivalente contra `taxpayers`.

**El bypass cuando la variable no está fijada es deliberado**, igual que en
`comprobify`: hay rutas legítimamente sin usuario (migraciones, tareas
administrativas, `/health`). Esas rutas se autentican por otros medios y no tocan
datos de contribuyentes.

**El usuario de base de datos de la aplicación no puede ser superusuario.** Los
superusuarios ignoran la RLS incondicionalmente, incluso con `FORCE`. Es un
requisito operativo sin forma de imponerlo desde el código, y por eso está también
en `GETTING_STARTED.md`.

## Consecuencias

### Positivas
- Defensa en profundidad: una consulta que olvide el filtro no devuelve datos ajenos.
- Independiente del ORM. Si Prisma se reemplaza, las políticas siguen ahí.
- La variable es transaccional: si la transacción falla, se revierte sola. No hay
  riesgo de contexto filtrado al reusar la conexión del pool.

### Negativas
- **Toda lectura, incluso trivial, requiere una transacción.** Dos viajes extra
  (`BEGIN` / `COMMIT`) por consulta suelta.
- Es fácil equivocarse: llamar a `prisma.invoice.findMany()` directamente en vez de
  pasar por el envoltorio compila y funciona — devuelve todo, sin filtrar. Requiere
  una regla de lint o una revisión disciplinada.
- Terreno nuevo para este conjunto de proyectos: `comprobify` hace RLS sin ORM,
  `comprobify-web` usa ORM sin RLS. **Debe probarse con un test de integración
  temprano** que verifique que el usuario A no ve los datos del usuario B, antes de
  construir sobre esta base.

## Alternativas consideradas

**Solo filtrado en la aplicación.** Sin sobrecarga, pero un solo defecto expone
datos tributarios de terceros. Inaceptable para este producto.

**Un esquema de PostgreSQL por usuario.** Aislamiento fuerte, pero las migraciones
se multiplican por el número de usuarios y el DDL se vuelve operativamente
complejo.

**RLS a nivel de sesión en lugar de transacción.** Evita las transacciones
envolventes, pero con un pool de conexiones la variable sobrevive a la petición y
se filtra a la siguiente. Peligroso precisamente en el escenario que la RLS busca
prevenir.
