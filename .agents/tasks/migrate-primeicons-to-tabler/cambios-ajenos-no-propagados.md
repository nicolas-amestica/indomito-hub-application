# Cambios ajenos que arrastraba el sync, y qué se hizo con cada uno

Fecha: 2026-10-19
Contexto: al propagar la regla de iconos desde `ind-hub-orc`, el `--dry-run` marcaba
archivos que no tienen nada que ver con esta tarea. Se eligió la **opción acotada**:
propagar solo a `app-ngx-hub` y `app-ngx-pay` con `--repo`, y no arrastrar lo ajeno.

Este documento existe para que puedas decidir después si quieres propagar lo pendiente.

---

## Ajeno #1 — `docs/standards/api-khipu-renditions.md` nunca sincronizado

**Qué es**: el documento `docs/standards/api-khipu-renditions.md` entró al orquestador en
el commit `ed8309a` (`fix(docs): actualiza contrato de rendiciones Khipu`) **sin correr el
sync**. El índice de estándares se genera listando los `.md` de `docs/standards/`, así que
cualquier sync posterior agrega ese documento al índice de los 6 repos.

**Archivos afectados**: `.kiro/steering/standards-ref.md` en los 6 repos consumidores.

**Contenido exacto del cambio** (2 líneas por archivo):

```diff
-<!-- Source: docs/standards/architecture/auth-flow.md, docs/standards/architecture/… -->
+<!-- Source: docs/standards/api-khipu-renditions.md, docs/standards/architecture/auth-flow.md, … -->
+- `docs/standards/api-khipu-renditions.md`
```

**Qué se hizo**: el sync lo escribió en Hub y Pay y **se devolvió el archivo a su contenido
commiteado** en ambos (`git show HEAD:… > …`). Hoy `standards-ref.md` está sin cambios en
los dos repos. Los otros cuatro repos nunca se tocaron.

**Ojo antes de propagarlo**: ese documento **hace fallar al validador de estándares** porque
no tiene YAML front matter:

```
$ bash tools/scripts/sync-context.sh --validate-only
ERROR docs/standards/api-khipu-renditions.md:1 [missing-metadata] Missing YAML front matter
Standards validation: 1 error(s), 0 warning(s).
```

Es un error **preexistente**, no lo introdujo esta tarea. Lo razonable es agregarle el front
matter (`title`, `scope`, `last-updated`) y recién entonces sincronizar los 6 repos.

---

## Ajeno #2 — la regla de bordes `border-line/75` nunca llegó a Pay

**Corrección de un diagnóstico previo**: en el primer análisis se describió este cambio como
"solo un timestamp". **Es falso**: es contenido real. Queda anotado porque el error de
diagnóstico podría repetirse.

**Qué es**: la regla de suavizado de bordes (`border-line/75` en claro, `dark:border-line/55`
en oscuro, aplicada también a los separadores internos de PrimeNG) ya está en las fuentes del
orquestador y en los artefactos de `app-ngx-hub`, pero **`app-ngx-pay` seguía con la redacción
anterior** (la que solo hablaba de `p-panel` y tarjetas anidadas). Viene de la tanda aprobada
inmediatamente anterior de este mismo trabajo, que se sincronizó a Hub y no a Pay.

**Contenido exacto del cambio** en Pay:

```diff
-- … Los bordes de `p-panel` y tarjetas anidadas deben usar tokens semánticos suaves en modo oscuro, …
+- … Todo borde neutro estructural debe usar el token semántico `line` suavizado: como referencia
+  `border-line/75` en modo claro y `dark:border-line/55` en modo oscuro. … incluidos los separadores
+  internos de PrimeNG mediante `styleClass`, `pt` o clases locales … Reservar un contraste mayor para
+  estados semánticos, foco, selección o marca. …
```

**Archivos afectados en Pay**: `AGENTS.md`, `.claude/CLAUDE.md`, `.gemini/GEMINI.md`,
`.claude/rules/global-rules.md`, `.claude/skills/angular-best-practices.md`,
`.kiro/skills/angular-best-practices.md`.

**Qué se hizo**: se dejó pasar, **a diferencia del ajeno #1**, por tres razones:

1. No es ruido externo: es una regla **tuya, ya aprobada**, que debía haber llegado a Pay en
   la tanda anterior. Revertirla dejaría a Pay con una regla de bordes obsoleta.
2. Es **inseparable** de la regla de iconos: ambas viven en los mismos archivos generados
   (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `global-rules.md`), que el generador escribe
   completos. No existe forma de quedarse con una línea y no con la otra.
3. Revertir solo los dos archivos de skills (donde sí es separable) habría dejado los
   artefactos de Pay contradiciéndose entre ellos sin eliminar el arrastre.

Al revisar el diff de Pay vas a ver, por lo tanto, **una línea extra** que no es de esta
tarea: la de bordes. Es la única.

---

## Resumen del estado

| Ajeno | Separable | Decisión | Estado hoy |
| --- | --- | --- | --- |
| #1 índice con `api-khipu-renditions.md` | sí | no propagar | `standards-ref.md` sin cambios en los 6 repos |
| #2 regla `border-line/75` en Pay | no (salvo skills) | propagar y reportar | presente en los artefactos de Pay |

## Residuo que hubo en el orquestador, y cómo quedó

Durante la exploración, un sondeo importó el módulo del generador y eso **ejecutó su rutina
principal**, que reescribió el espejo `ai/generated/**` y los artefactos propios del
orquestador para los 6 alias. Ningún repo consumidor fue modificado por ese sondeo
(verificado con `git status` en los 8 repos del workspace).

Eso dejó, en el espejo de los 4 alias que esta tarea no toca (`app-ngx-web`, `ind-hub-api`,
`ind-hub-iam`, `ind-hub-inf`), un problema real: la **primera redacción de la regla**, la que
prohibía PrimeIcons de forma global — precisamente la afirmación falsa para `app-ngx-web` que
había que evitar. Clasificado línea por línea, el residuo era: 54 líneas de manifiesto,
18+18 de la regla de bordes (nueva y antigua), 16 del índice de Khipu, **16 de la regla de
iconos obsoleta** y 4 de una versión vieja del override de Web. Todo contenido regenerable
desde las fuentes, sin nada único.

**Se limpió**: esos cuatro directorios del espejo y los artefactos propios del orquestador
cuyo único cambio era el timestamp (`.kiro/steering/output-style.md` y los 6 archivos de
skills, 14 líneas, todas `Generated by: … at <ISO>`) se devolvieron a su estado commiteado.

Estado final del orquestador: solo las 5 fuentes editadas, su propio
`.kiro/steering/agent-charter.md` y el espejo de `app-ngx-hub` y `app-ngx-pay`.

Nota menor y conocida: en el espejo de Hub y Pay, `standards-ref.md` y el `.sync-manifest.json`
sí quedaron regenerados con la línea del ajeno #1, aunque en los repos consumidores se revirtió.
Es una inconsistencia interna de archivos derivados que desaparece en el próximo sync completo;
no afecta a lo que leen los agentes en Hub ni en Pay.
