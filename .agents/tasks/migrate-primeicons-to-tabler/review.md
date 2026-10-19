# Migración de PrimeIcons (`pi`) a Iconify/Tabler + regla de iconos como steering

Se migraron a Iconify/Tabler las referencias `pi` que quedaban en código de producción de
`app-ngx-hub` (tres `chooseIcon` de `p-fileupload`, el candado del banner de contrato bloqueado y el
icono de la acción primaria del visor de PDF), se endureció la regla R7 del verificador de botones
para detectar también un `pi-x` suelto, y se dejó la regla de iconos en las fuentes del orquestador
acotada por repo. `app-ngx-pay` no tenía ocurrencias y no se tocó su código. La desviación más
relevante respecto del plan es deliberada y está bien fundada: la regla **no** quedó como prohibición
global en el charter, porque `app-ngx-web` usa PrimeIcons legítimamente en producción; una regla
global habría sido una afirmación falsa.

Watch for: la fuente de `app-ngx-web` quedó editada pero **sin propagar**, así que la línea que
protege ese repo ("aquí PrimeIcons es el set y la prohibición no aplica") no está activa en su
`AGENTS.md` (confirmado); el espejo `ai/generated/` de Hub y Pay quedó internamente inconsistente con
los repos consumidores en `standards-ref.md` y `.sync-manifest.json` (confirmado, documentado por el
implementador); y la verificación visual en las pantallas reales sigue pendiente porque están detrás
de autenticación (declarado). Ninguno de los tres bloquea.

**Verdict**: APPROVED

## High-level view

El inventario cierra. Mi propio barrido de `pi pi-`, `icon="pi`, `pi-spin`, `pi-spinner` y del patrón
genérico `pi(-| pi-)x` sobre `src/` y `tools/` de ambos frontends devuelve **cero ocurrencias en
código de producción**. Lo único que queda son 3 strings `pi pi-*` en `fn-iam-module-view.spec.ts`,
que son el dato de entrada que prueba la defensa contra iconos `pi` almacenados en DynamoDB, y 2
menciones en `document-preview-dialog.component.spec.ts` (un comentario y una aserción negativa
`not.toContain('pi-times')`). Conservarlas es correcto: borrarlas sería perder cobertura. En
`app-ngx-pay` no hay ninguna.

Los nombres Tabler son reales, y no solo los tres de esta tanda. Validé los **80 nombres distintos**
`icon-[tabler--*]` usados en todo `src/` contra los 6462 nombres y alias de
`node_modules/@iconify-json/tabler/icons.json`: cero inexistentes. Los casos trampa se comportan como
dice la nota: `circle-check` existe y `check-circle` no; `file-type-pdf` existe y `file-pdf` no.

El render está probado, no asumido. Los **80** iconos usados aparecen como regla completa en el CSS
emitido del bundle, y el bundle no contiene ninguna regla `.pi-*` ni rastro de `primeicons`. Eso
incluye `icon-[tabler--circle-check]`, que solo está escrito en un `.ts`, lo que confirma que Tailwind
escanea `.ts` y que no hacía falta tocar el `@source inline` de `styles.css`.

La regresión de ancho colapsado no volvió: no hay un solo `pButtonIcon` en código de producción (las
tres apariciones están en `button-loading.spec.ts`, que precisamente documenta y prueba el
comportamiento). El invariante de un spinner sigue en pie: la regla global de `src/styles.css`
conserva el acotamiento `:not([data-p])` en sus dos selectores, R5 lo verifica y no se tocaron los
specs del spinner.

El entregable B quedó en fuentes, no en salidas: `ai/source/global-context/agent-charter.md`,
`ai/source/repo-overrides/{app-ngx-hub,app-ngx-pay,app-ngx-web}.md` y el estándar
`docs/standards/frontend/design-system-usage.md`. Ninguno de esos cinco archivos lleva cabecera
`AUTO-GENERATED`. El estándar desarrolla solo mecánica y declara explícitamente que la regla por repo
vive en el contexto de cada repo, con lo que no hay duplicación entre estándar y steering. La regla
llega activa a Hub y Pay por el `AGENTS.md` de cada repo, que se carga automáticamente, y además por
`.claude/rules/repo-rules.md`, `CLAUDE.md` y `GEMINI.md`.

El punto flojo del entregable B es el alcance de la propagación. Se sincronizó solo Hub y Pay, de modo
que los otros cuatro repos quedaron con artefactos anteriores a la edición de las fuentes. Para
`ind-hub-api`, `ind-hub-iam` e `ind-hub-inf` es irrelevante (son backend/infra y la línea nueva del
charter es informativa). Para `app-ngx-web` sí importa: su fuente declara que PrimeIcons es su set y
que la prohibición no aplica ahí, pero ese texto no está en su `AGENTS.md`, así que el seguro no
protege todavía al repo que iba a proteger.

Git limpio en lo que se pidió: no hay commits nuevos en ninguno de los tres repos, no hay stash, los
cambios previos aprobados del working tree del Hub siguen presentes (los marcadores `border-line/75`
de `contract-list` y del visor están ahí) y el `src/styles.css` modificado de Pay sigue intacto.

<details>
<summary>Issues (6)</summary>

1. **`app-ngx-web` con fuente editada y sin propagar** (confirmado) — `ai/source/repo-overrides/app-ngx-web.md` declara PrimeIcons como su set, pero `giras_indomito_ng_dev_pub_usw2/AGENTS.md` no contiene esa línea ni la del charter. Correr `sync-context.sh --repo app-ngx-web` cuando se decida, o dejar anotado que el repo queda con drift deliberado.
2. **Espejo `ai/generated/` inconsistente con los consumidores** (confirmado) — en los espejos de Hub y Pay, `standards-ref.md` y `.sync-manifest.json` quedaron regenerados con la línea de `api-khipu-renditions.md` que sí se revirtió en los repos consumidores. Se resuelve en el próximo sync completo; no afecta lo que leen los agentes.
3. **Pay arrastra una línea ajena a esta tarea** (confirmado) — sus artefactos incorporan la regla `border-line/75` de la tanda anterior, inseparable de la de iconos porque el generador escribe los archivos completos. Revisar el diff de Pay con eso en mente.
4. **`--validate-only` sigue en rojo** (confirmado, preexistente) — `docs/standards/api-khipu-renditions.md` no tiene front matter, error del commit `ed8309a`. Agregarle `title`/`scope`/`last-updated` antes de sincronizar los 6 repos.
5. **Reset en el reflog del Hub** (posible) — el reflog muestra `merge fix/ui-contracts-collections-botones` a las 11:59 y `reset: moving to a7ccebc` a las 14:00. No se perdió contenido (el working tree conserva y amplía lo de la rama) y HEAD es el de partida, pero el merge `603ce09` solo es recuperable por reflog. Confirmar que ese reset fue intencional.
6. **Pantallas reales sin verificar** (confirmado, declarado) — formulario de contrato, documentos tributarios y visor de PDF en `PENDING_APPROVAL` están detrás de autenticación. Queda pendiente comprobar en claro/oscuro y a 320/390/tablet/escritorio la alineación del candado (`align-text-bottom`, con `align-[-0.1875em]` como ajuste previsto) y que los tres `p-fileupload` conserven su etiqueta.

</details>

<details>
<summary>Details</summary>

## Inventario: barrido propio, no confianza en la nota

Patrones ejecutados sobre `src/` y `tools/` de `ind-hub-app-ngx-pri-gh` y sobre `src/` de
`ind-pay-app-ngx-pri-gh`: `pi pi-`, `icon="pi`, `pi-spin`, `pi-spinner` y el genérico
`(^|[^[:alnum:]_-])pi( pi)?-[a-z0-9]`. Resultado en el Hub:

```
src/.../iam/fn/fn-iam-module-view.spec.ts:38,39,40   'pi pi-wallet' / 'pi pi-chart-line' / 'pi pi-play-circle'
src/.../document-preview-dialog.component.spec.ts:85  comentario `pi pi-*`
src/.../document-preview-dialog.component.spec.ts:88  not.toContain('pi-times')
tools/check-button-policy.mjs:58                      comentario de la propia regla R7
```

Cero en plantillas, cero en inputs `icon`, cero en constantes o mapas de menú, cero `pi-spin` /
`pi-spinner`, y `primeicons` no aparece ni en `package.json` ni en `src/`. En Pay, cero resultados con
todos los patrones. Las cinco ocurrencias que quedan coinciden exactamente con la línea base
`LEGACY_PI_ICONS` (3 y 2), que además tiene un guardia de "solo puede encoger" al final del
verificador, así que el inventario no puede volver a crecer sin que R7 falle.

La decisión de no tocar `resolveIamModuleIcon()` está bien argumentada: su guardia filtra valores que
llegan desde DynamoDB, no restos de código fuente. Limpiarla habría sido una regresión funcional.

## Nombres Tabler: verificación exhaustiva, no por muestreo

No me limité a los tres de esta tanda. Extraje los 80 nombres distintos `icon-[tabler--*]` presentes
en `src/**/*.{html,ts,css}` y los comparé contra el set instalado:

```
distinct used: 80   missing: 0
total nombres+alias en el set: 6462
upload OK | lock OK | circle-check OK | check-circle MISS | file-type-pdf OK | file-pdf MISS
```

Las tres equivalencias aplicadas (`pi-upload`→`upload`, `pi-lock`→`lock`,
`pi-check-circle`→`circle-check`) son directas y semánticamente idénticas, y el orden invertido de
`circle-check` está correctamente identificado como la trampa del naming.

## Render: la clase existe en el CSS, y para los 80 iconos

El fallo que originó toda esta tarea fue precisamente escribir una clase que no existe en el CSS, así
que comprobé la emisión y no solo la escritura. Sobre
`dist/ind-hub-app-ngx-pri-gh/browser/styles-62TCEPM4.css`:

```
iconos usados en src: 80   sin regla en el CSS: 0
primeicons -> 0 coincidencias
\.pi-      -> 0 coincidencias
```

`icon-[tabler--circle-check]` se emite pese a estar escrito solo en `contract-form.page.ts`, lo que
cierra la duda de si hacía falta ampliar el `@source inline` de `styles.css`: no hacía falta. El
`@source inline` sigue reservado, correctamente, a los nombres que llegan desde DynamoDB.

## `pButtonIcon` y el spinner

`grep -rn 'pButtonIcon' src/` devuelve tres líneas, todas en `src/app/shared/ui/button-loading.spec.ts`:
el comentario que explica la inferencia icon-only, el caso que la reproduce y el test que la nombra.
En producción no hay ninguna, de modo que la regresión de ancho colapsado no se reintrodujo. R6 del
verificador sigue cubriendo el caso con una condición razonable (`pButtonIcon` + texto propio y sin
`iconOnly` en el host).

El spinner no se tocó. `src/styles.css` conserva ambos selectores acotados:

```
165:  button.p-button-loading:not([data-p])::before {
177:  button.p-button-loading:not([data-p]).p-button-icon-only > * {
```

R5 verifica ese acotamiento leyendo el archivo, lo que es la decisión correcta dado que jsdom no
evalúa pseudo-elementos. No se modificaron los specs del spinner y la nota registra los 448 tests en
verde, incluido `button-loading.spec.ts`.

## R7 endurecido: el patrón y su alcance

El patrón pasó a `/(?<![\w-])pi(?: pi)?-[a-z0-9-]*/g`, que además de `pi pi-x` detecta un `pi-x`
suelto, antes invisible. El lookbehind evita los falsos positivos obvios (`api-`,
`icon-[tabler--…]`), y mi barrido independiente sobre `src/` no produjo ninguno. Dos detalles que
suman: el recorrido de archivos se amplió a `.ts` además de `.html`, y R7 se evalúa sobre el
**archivo completo** —no solo sobre las regiones de `template:`—, lo que es lo que permite atrapar un
icono `pi` escondido en una constante o en un mapa de menú, que era un requisito explícito del
pedido.

## Entregable B: ubicación, activación y duplicación

Los cinco archivos editados en el orquestador son fuentes. Ninguno tiene cabecera `AUTO-GENERATED`.
Propagación confirmada en los destinos esperados:

```
ind-hub-app-ngx-pri-gh   AGENTS.md: regla presente   repo-rules.md: presente
ind-pay-app-ngx-pri-gh   AGENTS.md: regla presente   repo-rules.md: presente
giras_indomito_ng_dev_pub_usw2   AGENTS.md: ausente
ind-hub-api / ind-hub-iam / ind-hub-inf   AGENTS.md: ausente (línea del charter)
```

Sobre la activación conviene ser preciso, porque el pedido era que la regla quedara activa como
steering y no solo como referencia. En Hub y Pay el `.kiro/steering/` generado contiene
`domain-context.md` con `inclusion: manual`, y la regla **no** está ahí: llega por `AGENTS.md`, que el
entorno carga automáticamente como regla de workspace. El resultado práctico es el pedido —la regla
se aplica sin que nadie la invoque— pero por el canal `AGENTS.md`, no por un archivo de steering con
`inclusion: auto` en el repo. El único `inclusion: auto` con esta regla es el
`.kiro/steering/agent-charter.md` del propio orquestador, que solo lleva la línea genérica.

No hay duplicación entre estándar y steering: la sección `## Sistema de iconos` del estándar abre
diciendo que el set permitido por repo "vive en el contexto de `app-ngx-hub`, `app-ngx-pay` y
`app-ngx-web`, y no se repite aquí", y a partir de ahí solo documenta mecánica (paquetes, forma de la
clase, patrón por tipo de uso, el `pi` inevitable del `p-fileupload` en modo avanzado, `@source
inline` para nombres que llegan de BD, cómo comprobar el CSS emitido). `last-updated` se actualizó a
`2026-10-19`. Sí hay duplicación literal del texto de la regla entre los repo-overrides de Hub y Pay,
inherente a una regla por repo que aplica a dos repos; es aceptable y el único coste es mantener dos
copias si la redacción cambia.

La desviación respecto del plan merece quedar registrada como acierto, no como incumplimiento: el plan
preveía la prohibición en el charter global, y el implementador la movió a los repo-overrides tras
verificar en el repo que `app-ngx-web` tiene `primeicons@^7.0.0` instalado, importado en
`src/styles.css` y con 19 ocurrencias activas. Una prohibición global habría sido falsa y capaz de
dirigir a un agente a romper un sitio en producción.

## Estado de git

Sin commits nuevos: el HEAD del Hub sigue en `a7ccebc`, el de Pay en `b1c0bee` y el del orquestador en
`ed8309a`, todos los mismos del punto de partida. `git stash list` vacío en el Hub. Los cambios
previos aprobados del working tree siguen presentes: `contract-list.page.html` conserva 20 marcadores
`border-line/75|55` y el visor de documentos 3. El `src/styles.css` de Pay mantiene sus 36 líneas
añadidas sin commitear.

El único punto a confirmar es el reflog: hubo un `merge --ff` de `fix/ui-contracts-collections-botones`
a las 11:59 y un `reset: moving to a7ccebc` a las 14:00. El contenido no se perdió —el working tree
contiene lo de esa rama y además las dos tandas posteriores— pero el merge `603ce09` quedó accesible
solo por reflog. No puedo determinar desde el diff si ese reset lo hizo el usuario o un paso previo
del trabajo.

</details>

<details>
<summary>Archivos revisados</summary>

`app-ngx-hub`: `contract-form.page.html` y `.ts` (iconos migrados), `tax-documents.page.html`
(`chooseIcon`), `tools/check-button-policy.mjs` (R7 y línea base), `src/styles.css` (R5 intacto),
specs de spinner y de visor; más los artefactos regenerados por el sync (`AGENTS.md`, `CLAUDE.md`,
`GEMINI.md`, `.claude/rules/*`, `.sync-manifest.json`).

`ind-hub-orc`: `ai/source/global-context/agent-charter.md`,
`ai/source/repo-overrides/{app-ngx-hub,app-ngx-pay,app-ngx-web}.md`,
`docs/standards/frontend/design-system-usage.md`, espejo `ai/generated/{app-ngx-hub,app-ngx-pay}/**`,
`.kiro/steering/agent-charter.md`.

`app-ngx-pay`: solo artefactos de contexto + `src/styles.css` preexistente. Código sin tocar.

</details>
