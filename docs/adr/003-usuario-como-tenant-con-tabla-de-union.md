# ADR-003: El usuario es el tenant, con tabla de unión

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

Hay dos perfiles de usuario y no está claro que necesiten estructuras distintas:

- Una **persona natural** que hace su propia declaración: un contribuyente.
- Un **contador** que administra varios clientes: N contribuyentes.

La propuesta inicial introducía una entidad `organizations` entre el usuario y los
contribuyentes, para soportar despachos con varios contadores compartiendo clientes.

Eso agrega un concepto que el 100% de los usuarios previstos del MVP no necesita, y
que hay que explicar en la interfaz o esconder con casos especiales. No hay demanda
validada de despachos multiusuario.

Lo que sí es caro es equivocarse al revés: migrar de "el usuario es el tenant" a
"la organización es el tenant" implica reescribir todas las políticas de RLS y
reparentar todos los contribuyentes, con datos reales en producción.

## Decisión

**El usuario es el tenant.** No existe entidad de organización.

Pero los contribuyentes se vinculan mediante una **tabla de unión desde el día uno**:

```
users ──< user_taxpayers >── taxpayers
```

- Hoy cada contribuyente tiene exactamente una fila, con `access = OWNER`.
- El concepto de "compartir" no existe en la interfaz.
- Mañana, agregar un colaborador es un `INSERT`, no una migración.

Los planes se definen por **dos** límites: número de contribuyentes y número de
usuarios. El segundo es 1 en todos los planes actuales, pero la columna existe.

El rol (`INDIVIDUAL` / `ACCOUNTANT`) es cambiable: una persona natural que empieza a
llevar contabilidad de terceros cambia de plan, y eso solo modifica un límite
numérico — no reestructura nada.

## Consecuencias

### Positivas
- Un concepto menos en el modelo y cero en la interfaz.
- La RLS es una sola política sobre `app.current_user_id`, sin ramas.
- La bitácora siempre sabe qué persona tomó cada decisión, porque nadie comparte
  credenciales por falta de una alternativa.
- Habilitar despachos multiusuario más adelante no requiere migración de datos.

### Negativas
- La tabla de unión es una indirección que hoy no aporta nada funcional. Toda
  consulta de contribuyentes pasa por un `JOIN` o un `EXISTS` que con un FK directo
  no haría falta.
- La política de RLS sobre tablas hijas usa una subconsulta en vez de comparar una
  columna. Requiere índice sobre `user_taxpayers(taxpayer_id)`.

## Alternativas consideradas

**FK directo `taxpayers.user_id`.** Es lo más simple y lo correcto si nunca hay
despachos con varios empleados. Descartado porque el costo de mantener la puerta
abierta es una tabla, y el costo de abrirla después es una migración con datos
tributarios en producción.

**Entidad `organizations` desde el inicio.** Soporta despachos de entrada, pero
introduce un concepto que ningún usuario del MVP necesita y que obliga a
crear organizaciones fantasma de un solo miembro para las personas naturales.
