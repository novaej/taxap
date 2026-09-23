# ADR-007: Modo sin IA y catálogo compartido de proveedores

## Estado
Aceptado

## Fecha
2026-09-20

## Contexto

Dado que los archivos del SRI no traen concepto, lo único que aporta un modelo de
IA en este sistema es **conocimiento del mundo sobre la identidad del proveedor**:
un motor de reglas no sabe que `MEGADATOS S.A.` vende servicios de internet; un
modelo sí.

Es un aporte real, pero acotado, y hay usuarios para quienes enviar datos de sus
clientes a un tercero es inaceptable por política propia o por compromiso
contractual con esos clientes.

Además, ese mismo conocimiento se puede acumular dentro del sistema: si muchos
usuarios clasifican al mismo proveedor de la misma forma, ese consenso es una
señal más confiable que la inferencia de un modelo, porque proviene de
profesionales decidiendo sobre proveedores ecuatorianos reales.

## Decisión

**Dos mecanismos complementarios.**

**1. El modo sin IA es una configuración de primera clase**, no un modo degradado.
Se activa por cuenta (`users.ai_enabled`). Con la IA apagada, la cascada corre los
niveles 1, 2 y 4. Nada se rompe, nada se bloquea.

**2. Catálogo compartido de proveedores.** Agregado global y **anónimo**: contiene
el RUC del proveedor, la categoría de consenso, el grado de acuerdo y el número de
observaciones. **No contiene identificadores de contribuyentes ni de usuarios.**
El proveedor no es dato sensible del comprador — la relación entre comprador y
proveedor sí lo es, y esa relación nunca entra al catálogo.

Un proveedor solo entra al catálogo al superar un umbral de observaciones
independientes, y el catálogo **sugiere**, no decide: por debajo de un umbral de
acuerdo, el comprobante va a la bandeja.

## Diferencia práctica entre los modos

| | Con IA | Sin IA |
|---|---|---|
| Primer período, contribuyente nuevo | Pocos en bandeja | Bastantes más en bandeja |
| Períodos siguientes | Mínimos | Pocos |
| Resultado final | Idéntico | Idéntico |

Ambos convergen al mismo lugar. **La IA no es el motor: acelera el arranque en frío.**

## Medición de consumo, no facturación

Se registra el consumo de IA por cuenta (`ai_usage`) para detectar abuso, no para
facturarlo. El costo medido —por debajo de $0.50 mensuales para 80 contribuyentes
en régimen estable— no justifica construir facturación medida. Los planes se
cobran por número de contribuyentes y de usuarios
([ADR-003](003-usuario-como-tenant-con-tabla-de-union.md)).

## Minimización de datos hacia la IA

Cuando el nivel 3 está activo, la consulta contiene únicamente:

```
Actividad económica del comprador: <código>
Régimen: <régimen>
Proveedor: <razón social>
Monto: <valor sin impuestos> | IVA: <iva>
```

**No se envía el RUC ni el nombre del contribuyente.** El modelo nunca sabe de
quién es la contabilidad.

Esto es minimización de datos, no anonimización — la identidad del proveedor es
irreductible porque *es* la señal de clasificación. Llamarlo anonimización en
material comercial sería inexacto.

## Consecuencias

### Positivas
- El modo sin IA es vendible como postura, no como carencia.
- El catálogo mejora con la base de usuarios y, con el tiempo, debería superar a la
  IA en cobertura de proveedores ecuatorianos.
- Desactivar la IA no requiere ningún camino de código alternativo.

### Negativas
- El catálogo compartido requiere masa crítica: durante los primeros meses aporta
  poco o nada, y el modo sin IA es genuinamente más trabajoso.
- Un sesgo sistemático entre los primeros usuarios se propaga como consenso
  aparente. Mitigado por el umbral de acuerdo y porque la sugerencia siempre es
  revisable, pero es un riesgo real que hay que vigilar.
- Hay que decidir y comunicar con claridad que las clasificaciones de un usuario
  alimentan un agregado compartido, aunque sea anónimo.
