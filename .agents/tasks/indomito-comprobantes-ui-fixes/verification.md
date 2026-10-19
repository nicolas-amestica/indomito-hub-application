# Verificación — corrección de regresiones de UI (7 puntos)

Repos: `ind-hub-app-ngx-pri-gh` (Hub) y `ind-pay-app-ngx-pri-gh` (Pay), ambos en `main`,
checkout principal, sin worktrees. Backend Go no tocado. **Sin commit** (ver sección final).

PrimeNG instalado: **22.1.1** (el bundle se autodeclara `22.1.5` internamente).

---

## 1. Punto 5 — red/green del verificador endurecido

`tools/check-button-policy.mjs` se endureció **antes** de arreglar los botones vacíos, para que
la prueba *red* fuese demostrable.

Reglas implementadas: R1 `<button>` con `pButton`; R2 `<a>` con `(click)` y `pButton` (lista
blanca explícita); R3 contenido visible; R4 atributos inertes (`label`, `icon`, `iconPos`,
`badge`, `loadingIcon`); R5 acotamiento de la regla global del spinner en `src/styles.css`.
Se **eliminó** la regla que exigía `[loading]`: ese input de la directiva está `@deprecated` en
PrimeNG 22 y era la causa del ruido del punto 4. Barre `.html` bajo `src/app` y plantillas
`template:` inline en `.ts`, con número de línea real sobre el archivo completo.

### RED — `node tools/check-button-policy.mjs` → exit 1

```
meeting-hosts.component.html:85: <button pButton> sin contenido visible ... (R3)
meeting-hosts.component.html:85: atributo inerte "label" ... (R4)
meeting-hosts.component.html:85: atributo inerte "icon" ... (R4)
contract-form.page.html:505: atributo inerte "icon" ... (R4)
contract-form.page.html:531: atributo inerte "icon" ... (R4)
contract-form.page.html:551: atributo inerte "icon" ... (R4)
contract-form.page.html:580: atributo inerte "icon" ... (R4)
contract-form.page.html:609: atributo inerte "icon" ... (R4)
contract-form.page.html:631: atributo inerte "icon" ... (R4)
contract-form.page.html:955: atributo inerte "icon" ... (R4)
contract-form.page.html:1066: atributo inerte "icon" ... (R4)
meet-calendar.page.html:16: <button pButton> sin contenido visible ... (R3)
meet-calendar.page.html:16: atributo inerte "label" ... (R4)
meet-calendar.page.html:16: atributo inerte "icon" ... (R4)
meet-calendar.page.html:111: <button pButton> sin contenido visible ... (R3)
meet-calendar.page.html:111: atributo inerte "label" ... (R4)
meet-calendar.page.html:114: <button pButton> sin contenido visible ... (R3)
meet-calendar.page.html:114: atributo inerte "label" ... (R4)
meet-calendar.page.html:114: atributo inerte "icon" ... (R4)
```

Dispara en los **4 botones vacíos** previstos (R3) y, además, en 8 `icon=` inertes de
`contract-form` que la auditoría había dado por inocuos. No reporta falsos positivos:
`contract-form.page.html:505` e `inbox-shell.page.html:114` ya no aparecen por R3 porque sí
tienen hijo visible.

Dos hallazgos que el plan no preveía, surgidos de la primera corrida:

- `app-mega-menu.component.html` está en `src/app/core/layout/`, no en `src/app/shared/layout/`.
  La ruta de la lista blanca se corrigió a la real.
- `side-drawer.component.html:2` es un velo a pantalla completa (`[unstyled]="true"` +
  `[attr.aria-label]`) intencionalmente sin etiqueta visible. R3 lo exime de forma explícita y
  documentada **solo** si combina `[unstyled]="true"` con un nombre accesible; sin nombre
  accesible sigue siendo violación.

### GREEN — tras el punto 1 y la limpieza de atributos inertes

```
Button policy: OK          (exit 0)
```

### R5 — red/green propio

```
# desacotando la regla a mano:
src/styles.css:148: la regla del spinner no está acotada con :not([data-p]);
  el componente <p-button> mostraría dos indicadores (R5)      → exit 1
# restaurada:
Button policy: OK                                              → exit 0
```

---

## 2. Punto 3 — un solo spinner

Discriminador verificado leyendo `node_modules/primeng/fesm2022/primeng-button.mjs` (no supuesto):

- Componente: el `<button>` interno lleva `[attr.data-p]="dataP()"` (línea 400) y `dataP()`
  incluye `loading: this.$loading()` (línea 356), así que **el atributo siempre está presente**
  en estado de carga; además renderiza `<svg data-p-icon="spinner">` (línea 411).
- Directiva: su host declara solo `class` y `style` (línea 771). **Nunca emite `data-p`** y no
  renderiza indicador alguno; solo agrega `p-button-loading`.

→ Acotamiento aplicado: `button.p-button-loading:not([data-p])::before` y
`button.p-button-loading:not([data-p]).p-button-icon-only > *`.

CSS emitido en `dist/.../styles-UUFG4ACE.css`:

```
button.p-button-loading:not([data-p]):before{...}
button.p-button-loading:not([data-p]).p-button-icon-only>*{...}
```

### Medición en navegador real (Chrome, cascada real)

| Caso | `::before` global | Indicadores propios | **Total visible** |
| --- | --- | --- | --- |
| `<button pButton [loading]>` | `content=""`, `width=16px` → aplica | 0 | **1** |
| `<p-button [loading]>` | `content=none` → excluido | 1 | **1** |

Esta es la prueba concluyente del punto 3: jsdom no evalúa pseudo-elementos, así que el conteo
en el navegador es lo único que demuestra que ninguno de los dos casos muestra dos spinners.

### Test vitest nuevo

`src/app/shared/ui/button-loading.spec.ts` monta **ambos** casos en estado `loading` y afirma el
discriminador que decide cuál indicador aplica: el componente tiene 1 indicador propio y `data-p`
con `loading`; la directiva tiene 0 propios y no tiene `data-p`. Ambos llevan `p-button-loading`.

Desviación respecto al plan, y por qué: el plan pedía además una aserción estática leyendo
`src/styles.css` con `node:fs` **dentro del spec**. No es viable: el proyecto no tiene
`@types/node` y `tsconfig.spec.json` solo expone `vitest/globals`, así que `node:fs` no compila
(`TS2591`); el fallback `import '...styles.css?raw'` tampoco sirve porque el pipeline de Angular
procesa el CSS y devuelve un módulo, no texto (`styles_default.split is not a function`). En vez
de agregar `@types/node` como dependencia nueva, esa garantía se trasladó a la **regla R5** del
script, que sí puede leer la hoja y queda cubierta por `npm run check:buttons`. El spec lo
documenta en su TSDoc.

---

## 3. Punto 2 — contraste de `severity="contrast"`

Vía elegida: la (b) del plan. Se conservan las 11 apariciones y se agregan **7 variables solo
dentro del bloque `.dark`** de `src/styles.css`, junto a las de `outlined-secondary`. No se toca
el modo claro, no se modifica `indomito.preset.ts`, no se agrega ningún selector global.

Confirmado en el CSS emitido: las 7 variables aparecen **una vez cada una y todas dentro de
`.dark`**. Confirmado en navegador — en claro las 7 quedan sin definir (las resuelve Aura, que ya
cumplía) y en oscuro resuelven a los valores fijados:

```
[claro]  las 7 → (sin definir, las resuelve el tema de PrimeNG)
[oscuro] --p-button-outlined-contrast-color        = #f4f4f5
         --p-button-outlined-contrast-border-color = #71717a
         --p-button-outlined-contrast-hover-background  = #34353a
         --p-button-outlined-contrast-active-background = #3f4046
         --p-button-text-contrast-color            = #f4f4f5
         --p-button-text-contrast-hover-background = #34353a
         --p-button-text-contrast-active-background = #3f4046
```

### Ratios WCAG (mínimos: 4.5:1 texto, 3:1 borde)

Modo claro — **sin cambios**, se documenta que ya cumplía:

| Elemento | Color | Fondo | Ratio | Mín. | |
| --- | --- | --- | --- | --- | --- |
| Texto `outlined contrast` y `text contrast` | `#1C1C1C` | `#FFFFFF` bg-surface | **17.04:1** | 4.5 | ✓ |
| Texto `outlined contrast` y `text contrast` | `#1C1C1C` | `#F9FAFB` bg-canvas | **16.31:1** | 4.5 | ✓ |
| Borde `outlined contrast` | `#3A3A3A` | `#FFFFFF` bg-surface | **11.37:1** | 3 | ✓ |
| Borde `outlined contrast` | `#3A3A3A` | `#F9FAFB` bg-canvas | **10.88:1** | 3 | ✓ |
| Texto sobre hover | `#1C1C1C` | `#F9FAFB` | **16.31:1** | 4.5 | ✓ |
| Texto sobre active | `#1C1C1C` | `#F3F4F6` | **15.49:1** | 4.5 | ✓ |

Modo oscuro — antes (defecto) y después:

| Elemento | Color | Fondo | Ratio | Mín. | |
| --- | --- | --- | --- | --- | --- |
| Texto `contrast` **antes** | `#1B1C1F` | `#1B1C1F` bg-surface | **1.00:1** | 4.5 | ✗ |
| Texto `contrast` **antes** | `#1B1C1F` | `#111214` bg-canvas | **1.10:1** | 4.5 | ✗ |
| Texto `outlined`/`text contrast` **después** | `#F4F4F5` | `#1B1C1F` bg-surface | **15.50:1** | 4.5 | ✓ |
| Texto `outlined`/`text contrast` **después** | `#F4F4F5` | `#111214` bg-canvas | **17.05:1** | 4.5 | ✓ |
| Borde `outlined contrast` **después** | `#71717A` | `#1B1C1F` bg-surface | **3.53:1** | 3 | ✓ |
| Borde `outlined contrast` **después** | `#71717A` | `#111214` bg-canvas | **3.88:1** | 3 | ✓ |
| Texto sobre hover **después** | `#F4F4F5` | `#34353A` | **11.13:1** | 4.5 | ✓ |
| Texto sobre active **después** | `#F4F4F5` | `#3F4046` | **9.40:1** | 4.5 | ✓ |

Los pares texto/panel y texto/canvas en oscuro se **remidieron en navegador** sobre la cascada
real y coinciden con el cálculo: 15.50:1 y 17.05:1.

**Corrección a una cifra del plan.** El plan afirmaba que el hover en oscuro *antes* del cambio
daba ~1.17:1. El valor real es **11.53:1** (`#1B1C1F` sobre `#D4D4D8`): el texto oscuro sobre un
fondo de hover casi blanco sí era legible. El defecto incapacitante era el **estado de reposo**
(1.00:1, etiqueta invisible); el hover era además un botón casi blanco, inconsistente con el
tema. El cambio corrige ambos. Los ratios de borde (3.53:1 / 3.88:1) provienen del valor del
token, no de medición en navegador, porque el CSS del botón de PrimeNG se inyecta en runtime y no
forma parte de `styles.css`; lo que sí se midió en navegador es que el token resuelve a `#71717a`.

---

## 4. Comandos ejecutados y resultado

### Hub

| Comando | Resultado |
| --- | --- |
| `npx ng build` | **OK**, sin warnings ni errores |
| `npx ng test --watch=false` | **443/443** en 91 archivos (441 previos + 2 nuevos) |
| `npm run check:buttons` | **Button policy: OK** |

El primer build emitió `NG8113: ButtonDirective is not used within the template of
MeetingHostsComponent` al volver ese botón al componente; se quitó el import y el segundo build
quedó limpio.

### Pay

| Comando | Resultado |
| --- | --- |
| `npx ng build` | **OK**, sin warnings ni errores |
| `npx ng test --watch=false` | **55/55** en 8 archivos |

CSS emitido en `dist/ind-pay-app-ngx-pri-gh/browser/styles-IYRX2KXX.css`:

```
button.p-button-loading:not([data-p]):before{...}
button.p-button-loading:not([data-p]).p-button-icon-only>*{...}
@keyframes indomito-button-spin{to{transform:rotate(1turn)}}
```

Se usó `currentColor` y las mismas unidades del Hub; ningún color literal ni token que ese repo
no tenga. Ese repo no usa hoy el componente `<p-button>`, pero el `:not([data-p])` se incluye
igual para que el contrato sea idéntico en ambos.

---

## 5. Verificación visual — alcance real

Herramienta: **`playwright-core` instalado en `/tmp/uiverify`, fuera de los dos repos**, dirigido
al Chrome del sistema (`/Applications/Google Chrome.app`). No se agregó ninguna dependencia a
`package.json` de ningún repo, ni se descargó un navegador nuevo.

### VERIFICADO EN NAVEGADOR (claro y oscuro, 320 / 390 / tablet 834 / escritorio 1440)

Sobre un banco de pruebas que carga la **hoja de estilos compilada real** y el marcado de las
variantes afectadas:

- Contraste de `outlined contrast` y `text contrast` sobre `bg-surface` y `bg-canvas`: medido en
  la cascada real, cifras de la tabla anterior. Etiquetas legibles en ambos temas; en oscuro ya
  no hay recuadros sin texto.
- Resolución de las 7 variables: definidas solo en oscuro, ausentes en claro.
- Conteo de spinners: exactamente 1 en cada forma de botón.
- Sin scroll horizontal en ninguno de los 4 anchos, en ambos temas (`scrollWidth == clientWidth`).

Capturas en `/tmp/uiverify/shots/{claro,oscuro}-{320,390,tablet,escritorio}.png`.

### NO VERIFICADO VISUALMENTE

Las páginas reales afectadas (`contract-list`, `contract-form` con su diálogo "Ver PDF",
`group-deposit`, `meeting-hosts`, `meet-calendar`) están detrás de autenticación y requieren el
backend, que no está disponible en este entorno. Por lo tanto **NO están verificados
visualmente**, y no deben darse por buenos sin una pasada manual:

- Suavizado percibido de las líneas de las tablas de `contract-list` y del historial de
  `contract-form` (el token aplicado es el del estándar, pero no se vio renderizado).
- Alineación de la celda de acciones de `contract-list` en anchos intermedios.
- Responsive y borde del diálogo "Ver PDF" en teléfono real.
- Panel del datepicker de `group-deposit`.
- Jerarquía visual de los tres botones apilados de la tarjeta móvil (punto 7a) en la página real.
- Espaciado icono-texto que aporta `pButtonIcon` (punto 7b) en la página real.

El banco de pruebas tampoco carga el CSS que PrimeNG inyecta en runtime para el componente
button, así que no refleja bordes, padding ni iconos reales: sirve para tokens, contraste y
conteo de spinners, no como vista previa de maquetación.

---

## 6. Archivos modificados

### Hub — `git status --short`

```
 M src/app/indomito-hub/administration/configuration/components/meeting-hosts/meeting-hosts.component.html
 M src/app/indomito-hub/administration/configuration/components/meeting-hosts/meeting-hosts.component.ts
 M src/app/indomito-hub/collections/pages/renditions/renditions.page.html
 M src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html
 M src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.ts
 M src/app/indomito-hub/contracts/pages/contract-list/contract-list.page.html
 M src/app/indomito-hub/contracts/pages/contract-list/contract-list.page.ts
 M src/app/indomito-hub/meet/meet-calendar.page.html
 M src/app/shared/documents/components/document-preview-dialog/document-preview-dialog.component.html
 M src/app/shared/documents/components/document-preview-dialog/document-preview-dialog.component.ts
 M src/styles.css
 M tools/check-button-policy.mjs
?? src/app/shared/ui/button-loading.spec.ts
```

### Pay — `git status --short`

```
 M src/styles.css
```

---

## 7. Resumen por punto

| # | Punto | Estado |
| --- | --- | --- |
| 1 | 4 botones vacíos → componente `<p-button label icon>` | Hecho. `type="submit"` conservado; es un input real del componente (`[attr.type]`) |
| 2 | 11 `severity="contrast"` + ratios en claro y oscuro | Hecho. Vía (b); ratios calculados y remedidos en navegador |
| 3 | Acotar la regla global del spinner + test | Hecho. `:not([data-p])` verificado en el bundle de PrimeNG y en navegador; test con ambos casos |
| 4 | Revertir `[loading]` de `renditions` 74/95/114/157 | Hecho. Línea 41 intacta; `check:buttons` ya no lo exige |
| 5 | Endurecer el verificador + red/green | Hecho. R1–R5; red y green registrados arriba |
| 6 | Portar la regla acotada a Pay | Hecho. Build y 55 tests OK; CSS emitido verificado |
| 7 | Menores (a–d) | Hecho los cuatro |

Punto 7 en detalle: (a) el tercer botón de la tarjeta móvil de `contract-list` pasó a
`severity="contrast" outlined` como sus vecinos; (b) `pButtonIcon` en `contract-list`,
`contract-form` y las tres del diálogo, con `ButtonIcon` importado en los tres componentes;
(c) icono `pi pi-file-pdf` unificado en los cuatro "Ver PDF" equivalentes; (d) `uppercase`
retirado del `input pInputText` de `meeting-hosts` — el valor se sigue persistiendo en mayúscula
porque el componente ya normaliza con `toUpperCase()`.

Extra no previsto por el plan, derivado de la regla R4: se eliminaron 8 atributos `icon=` inertes
en `contract-form` (líneas 505, 531, 551, 580, 609, 631, 955, 1066 del archivo original). Hoy no
renderizaban nada, así que su eliminación **no cambia nada de lo que ve el usuario**; es
eliminación de código muerto. No se añadió un icono real en su lugar, porque eso sí habría sido
un cambio visual no pedido.

---

## 8. Commit

**No se hizo commit en ningún repo.** El pedido original del usuario es explícito: *"no hagas
commit ya que quiero ver los archivos que toqué en el worktree"*. Los cambios quedan en el
working tree de `main` en ambos repos, sin `git add`. `git log -1` sigue apuntando al commit
previo a esta tanda en los dos.

---

# Iteración 2 — corrección de los hallazgos de la revisión

Revisión de partida: `review.json` / `review.md`, veredicto `CHANGES_REQUESTED`.
Dos hallazgos bloqueantes con una sola causa raíz, y tres no bloqueantes.

## 9. Causa raíz confirmada en el bundle instalado

`node_modules/primeng/fesm2022/primeng-button.mjs`:

```js
// 715-718
iconSignal  = contentChild(ButtonIcon,  { descendants: false });
labelSignal = contentChild(ButtonLabel, { descendants: false });
isIconOnly  = computed(() => !!(!this.labelSignal() && this.iconSignal()));
// 731
'p-button-icon-only': this.iconOnly() || o.iconOnly || this.isIconOnly(),
```

`grep -rn "pButtonLabel" src/` → sin resultados. El repositorio nunca marcó sus etiquetas, son
nodos de texto, así que basta un hijo con `pButtonIcon` para que `isIconOnly` sea verdadero y el
botón reciba `p-button-icon-only` (ancho cuadrado, `padding-inline: 0`, `gap: 0`).

Además, la propia librería lo desaconseja — línea 498 del mismo bundle:
`@deprecated Since v21. Place the icon (<svg>, <i>, or any element) directly` dentro del host.
La justificación del plan ("único mecanismo soportado") era incorrecta para la versión instalada.

## 10. Corrección aplicada (hallazgos 1 y 2, bloqueantes)

Retirado el atributo `pButtonIcon` de los 7 botones **que sí tienen etiqueta**, dejando el
`<span class="pi …" aria-hidden="true">` desnudo que había antes del diff:

| Archivo:línea | Etiqueta |
| --- | --- |
| `contract-list.page.html:75` | Ver PDF |
| `contract-list.page.html:162` | Ver PDF (`size="small"`) |
| `contract-form.page.html:164` | Ver copia firmada vigente |
| `contract-form.page.html:239` | Ver PDF (`w-full`) |
| `contract-form.page.html:279` | Ver PDF (`size="small"`) |
| `document-preview-dialog.component.html:77` | Descargar |
| `document-preview-dialog.component.html:89` | etiqueta dinámica |

Conservado **solo** en `document-preview-dialog.component.html:23`, que es icon-only de verdad
(botón de cerrar, sin etiqueta, con `aria-label`). Comprobado:

```
$ grep -rn "pButtonIcon" src/
src/app/shared/documents/components/document-preview-dialog/document-preview-dialog.component.html:23
```

Importes limpiados: `ButtonIcon` retirado de `contract-list.page.ts` y `contract-form.page.ts`
(quedaban sin uso); conservado en `document-preview-dialog.component.ts`. Ambos `.ts` volvieron
exactamente a su estado de HEAD, lo que confirma que el import era su único cambio.

El hallazgo 2 se resuelve por la misma vía: al no haber más `p-button-icon-only` mal inferida,
la regla `button.p-button-loading:not([data-p]).p-button-icon-only > *` de `src/styles.css:160`
ya no alcanza botones con etiqueta. **No se tocó el guard `:not([data-p])`**, que es correcto y
es lo que evita el doble spinner.

## 11. Garantías nuevas contra la reincidencia

La revisión anotó que R3 aceptaba cualquier elemento hijo como contenido visible y por tanto no
habría detectado esta regresión. Se cierra la brecha por dos vías.

### R6 en `tools/check-button-policy.mjs`

Un hijo con `pButtonIcon` no puede convivir con texto visible en el mismo host `pButton`, salvo
que el host declare `iconOnly` explícito.

```
# RED — reintroduciendo pButtonIcon en contract-list.page.html:75
$ node tools/check-button-policy.mjs
src/app/.../contract-list.page.html:67: hijo con pButtonIcon junto a texto visible; la directiva
lo infiere icon-only y colapsa el ancho del botón. Deja el icono como hijo desnudo (R6)
exit=1

# GREEN — estado corregido
$ node tools/check-button-policy.mjs
Button policy: OK
exit=0
```

### Test de contrato de ancho en `src/app/shared/ui/button-loading.spec.ts`

Dos casos nuevos que afirman la inferencia real de la directiva, no píxeles (jsdom no hace
layout, pero la clase sí es observable y es exactamente el mecanismo que causó el defecto):

- icono desnudo + etiqueta → el host **no** lleva `p-button-icon-only`, y el texto sigue presente
- `pButtonIcon` sin etiqueta → el host **sí** lleva `p-button-icon-only` (el caso legítimo)

Red demostrado: al reintroducir `pButtonIcon` en el host con etiqueta, el primer test falla en
`expect(button.classList.contains('p-button-icon-only')).toBe(false)`. Restaurado después.

## 12. Comandos ejecutados en esta iteración

### Hub

| Comando | Resultado |
| --- | --- |
| `npx ng build` | OK, bundle generado en 10.47 s, sin errores ni warnings nuevos |
| `npx ng test --watch=false` | **445 tests / 91 archivos, todos pasando** (441 previos + 4 del spec de botones) |
| `node tools/check-button-policy.mjs` | `Button policy: OK` (exit 0) |

La suite se ejecutó 3 veces completas en verde. En una ejecución intermedia falló
`per-passenger-split.property.spec.ts > Property 12`, un test de propiedades con `fast-check`
y semilla aleatoria; volvió a pasar en las dos corridas siguientes sin cambio alguno de código.
Es **flakiness preexistente y ajena a esta tanda** (no toca botones ni estilos), anotada aquí
para que no se confunda con una regresión.

### Pay

| Comando | Resultado |
| --- | --- |
| `npx ng build` | OK |
| `npx ng test --watch=false` | 55 tests / 8 archivos, todos pasando |

No se modificó ningún archivo de Pay en esta iteración. Se reverificó que las dos reglas del
spinner están dentro de `@layer components` (línea 118) y **no** dentro de `html.dark`, que
cierra en la línea 107; la cabecera del hunk de git induce a error pero el contenido es correcto.

## 13. Hallazgo 3 — objetivo táctil

Resuelto por la misma corrección: sin `p-button-icon-only` los botones vuelven a dimensionar por
contenido, de modo que desaparecen el ancho fijo de 2.5rem y el de 2rem de los `size="small"`.
Confirmado por el mecanismo (clase ausente, verificado por test) y **no medido en pantalla**,
por lo dicho en el punto 14.

## 14. Hallazgo 4 — verificación visual: NO VERIFICADO VISUALMENTE

Se comprobó de nuevo que no hay automatización de navegador disponible:

```
$ ls node_modules/.bin | grep -i "playw|puppet|chrom"   → sin resultados
$ ls node_modules | grep -i "playwright|puppeteer"      → sin resultados
```

Y las páginas afectadas (`contract-list`, `contract-form` con su diálogo "Ver PDF",
`group-deposit`, `meeting-hosts`, `meet-calendar`) están detrás de autenticación y requieren el
backend, por lo que no se pueden renderizar con datos reales en este entorno.

**Quedan NO VERIFICADOS VISUALMENTE**, y no se asumen correctos:

- ancho final y objetivo táctil de los 7 botones corregidos, en claro y oscuro
- suavizado percibido de las líneas de las tablas de `contract-list` y `contract-form`
- alineación de la celda de acciones al reducir el ancho
- responsive del diálogo "Ver PDF" en teléfono (320 / 390)
- panel del datepicker de "Fecha efectiva" en `group-deposit`
- jerarquía de los 3 botones de la tarjeta móvil de `contract-list`

Todo lo afirmado sobre estos puntos se deriva de contratos de código (inferidor de la directiva,
hoja de estilos del componente, orden de capas de `app.config.ts`) y de valores de token, no de
apreciación visual. Requieren una pasada manual del usuario.

## 15. DEUDA ABIERTA — borde de `outlined-secondary` en modo claro

**Defecto.** El borde de la variante `outlined-secondary` en modo claro resuelve a `#E2E3E5`
sobre `#FFFFFF` = **1.28:1**, por debajo del mínimo de **3:1** de WCAG 1.4.11 para límites de
componentes de interfaz. Cadena de resolución: Aura define
`outlined.secondary.borderColor = light-dark({surface.200}, {surface.700})` y el preset del Hub
mapea `surface.200` a `var(--color-line)`, que en claro es `#E2E3E5`.

**Es preexistente y ajeno a esta tanda.** No lo introdujo ninguno de los cambios de estas
iteraciones. El plan lo documentó, la revisión lo confirmó y lo marcó no bloqueante, y el usuario
decidió explícitamente no abordarlo ahora (opción B).

**Arreglo propuesto.** Una sola línea: fijar `--p-button-outlined-secondary-border-color` en modo
claro, fuera del bloque `.dark`, con un tono del token `line` (o el semántico `control-border`)
que alcance 3:1. El mecanismo ya está probado aquí: es el mismo bloque `:root` sin `@layer` que se
usó en la sección 19 para la variante `contrast`.

**Radio de impacto concreto.** La variante la usan botones de todo el Hub, no solo la pantalla
reportada:

- `inbox-shell.page.html` — los "Cancelar" de los diálogos de alias, eliminación y marcado masivo,
  más "Reintentar" y "Cargar más"
- `meet-calendar.page.html` — "Hoy" y "Refrescar"
- `contract-form.page.html` — botones de severity `secondary` de la cabecera
- `meeting-hosts.component.html` — "Cancelar" del diálogo y el botón "Editar" de la tabla
- `document-preview-dialog.component.html` — pestañas inactivas del visor (**ya resuelto por
  instancia** en la sección 17, sin tocar el token global)

**Por qué queda pendiente.** El charter es explícito: un cambio al preset o a los tokens globales
del sistema de diseño es una modificación transversal que exige validar visualmente todas las
pantallas afectadas. Este entorno no tiene navegador ni backend (sección 14), así que subirlo a
ciegas repetiría el error ya cometido con `severity="contrast"`: pasó build y tests y dejaba texto
invisible en modo oscuro.

**Tamaño real.** Es una tarea chica — una línea de token — pero necesita una pasada en pantalla
sobre las cinco pantallas de arriba, en claro y oscuro, antes de aplicarse.

---

# Iteración 3 — opción B, iconos invisibles y suavizado del borde

## 16. Estado de git

**Sin commit en ninguno de los dos repos**, conforme al pedido original del usuario
(*"no hagas commit ya que quiero ver los archivos que toqué en el worktree"*). Todos los cambios
de las tres iteraciones están en el working tree de `main`, sin `git add`.

## 17. Opción B — contraste de las pestañas del visor, acotado

Decisión del usuario: subir el contraste **solo** en el visor de documentos y **no** tocar
`--p-button-outlined-secondary-border-color` en modo claro.

Aplicado en `document-preview-dialog.component.html:38` por instancia, con el token semántico
`control-border` vía utilidad de Tailwind y el modificador `!`, que es el mecanismo que ya usa
este repositorio (`border-line/75!` en las tablas de `contract-list`, `styleClass="dark:border-line/55!"`
en el diálogo de `meeting-hosts`):

```html
[class.border-control-border!]="activeIndex() !== index"
```

Se eligió el modificador `!` deliberadamente y no la utilidad simple: la capa `utilities` de
Tailwind y la capa `primeng` que PrimeNG inyecta en runtime no tienen un orden garantizado entre
sí, y el selector de PrimeNG (`.p-button-outlined.p-button-secondary`) tiene más especificidad.
Con `!important` el resultado no depende de ese orden. Verificado en el CSS emitido:

```
.border-control-border\!{border-color:var(--color-control-border)!important}
```

No se introdujo ninguna variable nueva fuera del bloque `.dark` que afecte a otros botones, ni
selectores globales sobre elementos de formulario, ni se tocó el preset.

### Ratios (mínimos: 4.5:1 texto, 3:1 límite de componente)

| Elemento | Modo | Antes | Después | Cumple |
| --- | --- | --- | --- | --- |
| Borde pestaña inactiva | claro | `#E2E3E5` 1.28:1 | `#858585` **3.69:1** | sí |
| Borde pestaña inactiva | oscuro | `#71717A` 3.53:1 | `#71717A` **3.53:1** (intacto) | sí |
| Texto pestaña inactiva | claro | `#616161` 6.19:1 | sin cambio **6.19:1** | sí |
| Texto pestaña inactiva | oscuro | `#D4D4D8` 11.53:1 | sin cambio **11.53:1** | sí |
| Texto pestaña activa | ambos | `#1C1C1C` sobre `#EBFF00` 15.29:1 | sin cambio | sí |

El modo oscuro **no se degrada**: la utilidad fija el mismo `#71717A` que ya resolvía allí, porque
`--color-control-border` vale `#71717A` dentro de `.dark`.

### Distinción activa vs inactiva (punto 4 del pedido)

La activa es `primary` llena (amarillo de marca `#EBFF00`, sin borde) y la inactiva es `outlined`
sobre el panel. Fondo contra fondo: **1.11:1 en claro** y **15.28:1 en oscuro**.

El 1.11:1 de claro es una observación honesta: en modo claro la distinción **no** descansa en la
luminancia sino en el tono (amarillo saturado contra blanco) y en el relleno. Es preexistente y no
lo introduce este cambio. Lo relevante para el punto 4 es que el cambio **aumenta** la distinción
en lugar de reducirla: antes ambos estados tenían contorno casi imperceptible; ahora la inactiva
tiene un contorno definido a 3.69:1 y la activa sigue sin contorno y con relleno de marca. Se
agregó además `aria-current="true"` en la pestaña activa, de modo que el estado también se expone
a tecnología asistiva y no solo por color.

### Consistencia de jerarquía (punto 5 del pedido)

Las pestañas siguen siendo todas `<button pButton>` con `size="small"`; lo único que varía entre
ellas es el par `outlined`/`severity`, que es precisamente lo que codifica el estado. No se mezclan
componentes ni tamaños.

### Test

`document-preview-dialog.component.spec.ts` (nuevo, 3 casos): el borde reforzado cae solo en las
inactivas, se mueve al cambiar de pestaña junto con `aria-current`, y el botón de cerrar conserva
nombre accesible e icono real. Red demostrado: al retirar el binding, 2 de los 3 casos fallan.

## 18. Hallazgo de meeting-hosts — causa raíz: el set de iconos `pi` no existe en este proyecto

El usuario reportó que no se ven los textos/íconos de los botones de la columna "Acciones".

**No es un problema de contraste.** Los ratios del icono, resueltos desde los tokens reales, están
muy por encima del mínimo en ambos modos:

| Botón | Claro | Oscuro |
| --- | --- | --- |
| Editar (`outlined secondary`) | `#616161` sobre `#FFFFFF` **6.19:1** | `#D4D4D8` sobre `#1B1C1F` **11.53:1** |
| Eliminar (`outlined danger`) | `#EF4444` sobre `#FFFFFF` **3.76:1** | `#F87171` sobre `#1B1C1F` **6.16:1** |

**La causa real es que el icono no se renderiza en absoluto**, no que se vea mal:

1. `primeicons` **no está en `package.json`**, **no está instalado** en `node_modules` y **no se
   importa** en ningún archivo ni en `angular.json`.
2. En el CSS compilado hay **cero** coincidencias de `primeicons`, de `.pi-*` o de un `@font-face`
   correspondiente. Las clases `pi pi-*` no tienen hoja de estilos en este proyecto.
3. El sistema de iconos real del Hub es Iconify/Tabler: `@iconify-json/tabler` +
   `@iconify/tailwind4`, declarado con `@plugin '@iconify/tailwind4'` en `src/styles.css:2`.
4. El propio repositorio ya trata `pi` como legacy muerto: `resolveIamModuleIcon()` descarta
   explícitamente cualquier icono que empiece con `pi ` y lo reemplaza por `icon-[tabler--point]`.

Esto explica con precisión el síntoma y por qué solo se nota aquí: un botón **con etiqueta** y un
`pi` roto muestra su texto y el icono ausente pasa desapercibido; un botón **icon-only** con un
`pi` roto queda **completamente en blanco**. Los de la columna "Acciones" son icon-only.

### Barrido completo de `pi pi-*` (26 ocurrencias) y clasificación

**CORREGIDOS — los 5 botones icon-only que quedaban en blanco:**

| Archivo:línea | Botón | Antes | Después |
| --- | --- | --- | --- |
| `meeting-hosts.component.html:36` | Editar anfitrión | `pi pi-pencil` | `icon-[tabler--pencil] size-4` |
| `meeting-hosts.component.html:37` | Eliminar anfitrión | `pi pi-trash` | `icon-[tabler--trash] size-4` |
| `meet-calendar.page.html:11` | Mes anterior | `pi pi-chevron-left` | `icon-[tabler--chevron-left] size-5` |
| `meet-calendar.page.html:13` | Mes siguiente | `pi pi-chevron-right` | `icon-[tabler--chevron-right] size-5` |
| `document-preview-dialog.component.html:23` | Cerrar visor | `pi pi-times` | `icon-[tabler--x] size-5` |

Se siguió el patrón ya establecido en `inbox-shell.page.html`, que es la referencia del repo para
botones icon-only: icono como hijo desnudo con clase Iconify y tamaño explícito, más nombre
accesible. Verificado que las cinco clases se generan en el CSS compilado.

Dos ajustes que acompañan:

- Los dos botones de navegación de `meet-calendar` **no tenían nombre accesible** (solo icono, sin
  `ariaLabel`): se les agregó "Mes anterior" y "Mes siguiente". Cambio invisible, cierra un hueco
  de accesibilidad en botones que además estaban en blanco.
- En el botón de cerrar del visor se reemplazó el `pButtonIcon` por el atributo `iconOnly` en el
  host, que es lo que usa `inbox-shell` y evita el atributo `@deprecated`. Se comprobó en el bundle
  que `iconOnly = input(false, { transform: booleanAttribute })`, de modo que el atributo suelto
  resuelve a `true`. Con esto `pButtonIcon` desaparece de todo `src/app` salvo el spec que prueba
  el comportamiento de la librería, y el import de `ButtonIcon` se retiró del componente.

**NO CORREGIDOS — las 21 ocurrencias restantes, que requieren decisión del usuario:**

Son botones **con etiqueta visible** (o configuraciones de `p-fileupload` y de un toast) donde el
`pi` tampoco renderiza, pero el texto sí se ve, así que no hay nada en blanco:

- `meet-calendar.page.html:5, 16, 114` — "Nueva reunión", "Refrescar", "Guardar"
- `meeting-hosts.component.html:9, 85` — "Agregar anfitrión", "Guardar"
- `contract-list.page.html:75, 162` — "Ver PDF"
- `contract-form.page.html:112, 164, 239, 279` — candado y los "Ver PDF"
- `document-preview-dialog.component.html:77` — "Descargar"
- `contract-form.page.html:72, 200` y `tax-documents.page.html:167` — `chooseIcon` de `p-fileupload`
- `contract-form.page.ts:622` — `icon` de una acción del visor
- `fn-iam-module-view.spec.ts:38-40` — cadenas `pi` usadas como entrada de prueba del mapeador
  legacy; correctas tal como están

Migrarlos haría **aparecer iconos donde hoy la interfaz no muestra ninguno**, en pantallas que el
usuario no reportó. Eso es un cambio visual que no se pidió, así que se deja a su criterio. Nótese
que los `pi pi-file-pdf` de los "Ver PDF" los agregó el punto 7c de la primera iteración con la
intención de que se vieran; nunca se vieron.

## 19. Suavizado del borde `contrast` en modo claro

El usuario reportó que algunos botones afectados quedaron "muy fuertes" en modo claro. El
sospechoso señalado se confirma: Aura resuelve
`outlined.contrast.borderColor = light-dark({surface.700}, {surface.500})`, y el preset mapea
`surface.700` a `var(--color-graphite)` = `#3A3A3A`, es decir **11.37:1** sobre el blanco del
panel. Casi negro, muy por encima del 3:1 que exige WCAG 1.4.11 y compitiendo con el contenido.

Corrección en `src/styles.css`, bloque `:root` nuevo, con el mismo criterio acotado del bloque
`.dark`: **una sola variable, solo la variante `contrast`**. Las variantes `secondary`, `danger` y
`primary` quedan intactas.

```css
:root {
  --p-button-outlined-contrast-border-color: var(--color-control-border);
}
```

El bloque va sin `@layer` a propósito: una declaración sin capa gana a la capa `primeng` que
PrimeNG inyecta en runtime, que es el mismo mecanismo por el que funcionan los overrides del
bloque `.dark`. Verificado en el CSS emitido:
`:root{--p-button-outlined-contrast-border-color: var(--color-control-border)}`.

Afecta a las 12 apariciones de `severity="contrast"` de la tanda: `contract-form` 233 y 273,
`contract-list` 70, 79, 87, 157, 168 y 177, y `document-preview-dialog` 20, 70, 79 y 83.

### Tabla antes/después — `outlined contrast`

| Elemento | Modo | Antes | Después | Mínimo | Cumple |
| --- | --- | --- | --- | --- | --- |
| Borde sobre panel `#FFFFFF` | claro | `#3A3A3A` 11.37:1 | `#858585` **3.69:1** | 3:1 | sí |
| Borde sobre canvas `#F9FAFB` | claro | `#3A3A3A` 10.88:1 | `#858585` **3.53:1** | 3:1 | sí |
| Texto sobre panel | claro | `#1C1C1C` 17.04:1 | **sin cambio** 17.04:1 | 4.5:1 | sí |
| Texto sobre canvas | claro | `#1C1C1C` 16.31:1 | **sin cambio** 16.31:1 | 4.5:1 | sí |
| Borde sobre panel `#1B1C1F` | oscuro | `#71717A` 3.53:1 | **intacto** 3.53:1 | 3:1 | sí |
| Borde sobre canvas `#111214` | oscuro | `#71717A` 3.88:1 | **intacto** 3.88:1 | 3:1 | sí |
| Texto sobre panel | oscuro | `#F4F4F5` 15.50:1 | **intacto** 15.50:1 | 4.5:1 | sí |
| Texto sobre canvas | oscuro | `#F4F4F5` 17.05:1 | **intacto** 17.05:1 | 4.5:1 | sí |

El borde queda en el rango pedido de 3:1–4.5:1 y **no se tocó el color del texto**. El modo oscuro
queda exactamente en los valores de la auditoría.

### Estados hover, active, focus y disabled (punto 6 del pedido)

| Estado | Modo | Fondo | Texto | Borde nuevo vs ese fondo |
| --- | --- | --- | --- | --- |
| hover | claro | `#F9FAFB` | 16.31:1 | 3.53:1 |
| active | claro | `#F1F2F3` | 15.20:1 | 3.29:1 |
| focus | claro | panel | anillo `#1C1C1C` 17.04:1 | — |
| hover | oscuro | `#34353A` | 11.13:1 | 2.53:1 |
| active | oscuro | `#3F4046` | 9.40:1 | 2.14:1 |

Todos los textos siguen muy por encima de 4.5:1 y los cuatro estados siguen distinguibles entre
sí por su fondo. Dos notas honestas: en claro el borde contra el fondo del propio botón en `active`
baja a 3.29:1, que sigue sobre 3:1; en oscuro baja a 2.53:1 y 2.14:1, pero eso es **preexistente y
no se tocó** — y la medida que exige 1.4.11 es el límite del componente contra el fondo adyacente
(el panel), que es 3.53:1 y sí cumple. `disabled` no es per-severity en Aura: se resuelve con
`disabledOpacity: 0.6` sobre el mismo par, de modo que el cambio no lo altera.

### Jerarquía (punto 7 del pedido)

Las acciones adyacentes de `contract-list` (Ver PDF / Anexos / Detalle) y de `document-preview-dialog`
(Descargar / Cerrar) conservan la misma severity, variante, tamaño, borde y radio entre sí; la
variable tocada es común a todas, así que el suavizado las afecta por igual y la uniformidad se
mantiene.

## 20. Comandos de esta iteración

| Comando | Repo | Resultado |
| --- | --- | --- |
| `npx ng build` | hub | OK, sin errores |
| `npx ng test --watch=false` | hub | **448 tests / 92 archivos, todos pasando** |
| `npm run check:buttons` | hub | `Button policy: OK` |

448 = 445 de la iteración 2 + 3 del spec nuevo del visor. Red demostrado en los dos specs nuevos:
al retirar el binding del borde fallan 2 de 3 casos del visor; al reintroducir `pButtonIcon` falla
el caso de ancho.

No se modificó el repo de pagos en esta iteración, así que sus resultados de la sección 12 siguen
vigentes.

### Qué quedó sin verificar visualmente, y por qué

Lo mismo que la sección 14, sin cambios: no hay navegador en el entorno y las pantallas están
detrás de autenticación. En concreto, de esta iteración quedan **NO VERIFICADOS VISUALMENTE**:

- el peso visual percibido del borde suavizado a 3.69:1 en claro — el objetivo declarado por el
  usuario era "perceptible pero discreto", y eso es un juicio que requiere verlo
- el render real de los 5 iconos Tabler migrados y su alineación dentro del botón
- el contorno de las pestañas inactivas del visor y la distinción activa/inactiva en pantalla
- el área táctil de los botones icon-only de la columna "Acciones" en móvil

Los ratios y la existencia de las clases en el CSS compilado sí están verificados numéricamente y
por grep sobre el bundle.


## 21. Iteracion 4 — cierre de los hallazgos de `review.json`

Hallazgos 1, 2 y 3 corregidos. El hallazgo 4 (borde de `outlined-secondary` en claro a 1.28:1)
queda como estaba: es preexistente y el usuario eligio explicitamente no abordarlo (seccion 15).

### 21.1 Correccion del nombre del icono

`review.json` indicaba migrar a `icon-[tabler--file-pdf]`. **Ese icono no existe** en el set
instalado. Comprobado contra `@iconify-json/tabler/icons.json`:

| Nombre consultado | Existe |
| --- | --- |
| `file-pdf` | no |
| `file-type-pdf` | **si** |
| `pdf` | si (generico, sin hoja de documento) |

Se uso `file-type-pdf`, que es el equivalente real de `pi pi-file-pdf`. Si se hubiera seguido la
indicacion al pie de la letra, el icono habria seguido sin verse y el build habria emitido
`Cannot find "tabler--file-pdf". Bad icon name?`.

### 21.2 Hallazgos 1 y 2 — iconos `pi` inertes migrados a Tabler

Se migraron los 8 iconos de botones que esta tanda toco, mas 3 vecinos directos. El criterio del
estandar obliga a incluir a los vecinos: "acciones adyacentes de misma jerarquia con el mismo
componente/directiva y misma severity/variante/tamano". Dejar visible el icono de "Refrescar" y
fantasma el de "Nueva reunion", contiguos en la misma barra, habria creado justo la inconsistencia
que el estandar prohibe.

| Archivo:linea | Antes | Despues | Motivo |
| --- | --- | --- | --- |
| `contract-list.page.html:75` | `class="pi pi-file-pdf"` | `icon-[tabler--file-type-pdf] size-4` | hallazgo 1 (agregado por 7c) |
| `contract-list.page.html:162` | `class="pi pi-file-pdf"` | idem | hallazgo 1 (cuarto equivalente) |
| `contract-form.page.html:164` | `class="pi pi-file-pdf"` | idem | 5.o equivalente, "Ver copia firmada vigente" |
| `contract-form.page.html:239` | `class="pi pi-file-pdf"` | idem | hallazgo 1 (agregado por 7c) |
| `contract-form.page.html:279` | `class="pi pi-file-pdf"` | idem | hallazgo 1 (agregado por 7c) |
| `meeting-hosts.component.html:85` | `icon="pi pi-check"` | `icon="icon-[tabler--check] size-4"` | hallazgo 2 (restaurado por punto 1) |
| `meet-calendar.page.html:16` | `icon="pi pi-refresh"` | `icon="icon-[tabler--refresh] size-4"` | hallazgo 2 (restaurado por punto 1) |
| `meet-calendar.page.html:114` | `icon="pi pi-check"` | `icon="icon-[tabler--check] size-4"` | hallazgo 2 (restaurado por punto 1) |
| `meet-calendar.page.html:5` | `icon="pi pi-plus"` | `icon="icon-[tabler--plus] size-4"` | vecino de :16 en la misma barra |
| `meeting-hosts.component.html:9` | `icon="pi pi-plus"` | `icon="icon-[tabler--plus] size-4"` | vecino de :85 en el mismo componente |
| `document-preview-dialog.component.html:80` | `class="pi pi-download"` | `icon-[tabler--download] size-4` | boton del visor que el usuario reporto como "no se ven" |

Tambien se alinearon las plantillas sinteticas de `button-loading.spec.ts:51,61` (`pi pi-file-pdf`
y `pi pi-times`) al sistema real, para que el spec no contradiga el comentario del spec del visor.

**Prueba de que ahora si renderizan.** `grep` sobre el CSS compilado
(`dist/ind-hub-app-ngx-pri-gh/browser/styles-MJIIARWB.css`), una coincidencia exacta por clase:

| Clase | Reglas emitidas |
| --- | --- |
| `icon-[tabler--file-type-pdf]` | 1 |
| `icon-[tabler--check]` | 1 |
| `icon-[tabler--refresh]` | 1 |
| `icon-[tabler--plus]` | 1 |
| `icon-[tabler--download]` | 1 |
| `icon-[tabler--x]` / `pencil` / `trash` | 1 cada una (ya migradas) |
| `primeicons` o cualquier `.pi-*` | **0** |

Las 0 coincidencias de `.pi-*` confirman el diagnostico del revisor: los spans anteriores eran
marcado muerto, sin icono y con el hueco flex de `gap: 0.5rem`.

### 21.3 Hallazgo 3 — regla R7 en el verificador

`tools/check-button-policy.mjs` suma la regla **R7**: ninguna referencia `pi pi-*` en `src/app`,
con linea base explicita `LEGACY_PI_ICONS` (mapa archivo -> recuento exacto). Cubre el hueco que
señalo el revisor: R4 solo vigila la *directiva*, asi que `<p-button icon="pi ...">` pasaba porque
el input es valido aunque el set no exista.

Dos mitades, para que la linea base no se afloje en ninguna direccion:

- mas referencias de las declaradas en un archivo (o cualquiera en un archivo no listado) -> falla
- menos referencias de las declaradas -> falla pidiendo bajar el recuento

Linea base declarada (deuda preexistente, 9 referencias):

| Archivo | Refs | Que son |
| --- | --- | --- |
| `contract-form.page.html` | 3 | `chooseIcon` de dos `p-fileupload` + candado del aviso |
| `contract-form.page.ts` | 1 | `icon` del `confirmDialog` de aprobacion |
| `tax-documents.page.html` | 1 | `chooseIcon` de un `p-fileupload` |
| `fn-iam-module-view.spec.ts` | 3 | datos de entrada del mapeador legacy (intencional) |
| `document-preview-dialog.component.spec.ts` | 1 | mencion en prosa de un comentario |

**No se migraron** porque hacerlo haria aparecer iconos donde hoy no hay nada: es un cambio
visible que el usuario no pidio y que el revisor acepto dejar a su decision. Quedan acotadas por
regla, de modo que el inventario no puede crecer.

#### Red / green de R7

```
# RED — se reintrodujo un span pi y un icon= pi de componente
$ node tools/check-button-policy.mjs
contract-list.page.html:75: icono "pi pi-file-pdf" del set pi, que este proyecto no instala... (R7)
contract-list.page.html:162: icono "pi pi-file-pdf" ... (R7)
meet-calendar.page.html:16: icono "pi pi-refresh" ... (R7)
exit=1

# GREEN — con los iconos migrados
$ node tools/check-button-policy.mjs
Button policy: OK
exit=0
```

### 21.4 Comandos de esta iteracion

| Comando | Repo | Resultado |
| --- | --- | --- |
| `npx ng build` | hub | OK |
| `npx ng test --watch=false` | hub | **448 tests / 92 archivos, todos pasando** |
| `node tools/check-button-policy.mjs` | hub | `Button policy: OK`, exit 0 (red/green arriba) |
| `npx ng build` | pay | OK |
| `npx ng test --watch=false` | pay | **55 tests / 8 archivos, todos pasando** |

El recuento de tests no cambia (448): esta iteracion no agrega casos, solo corrige clases de
icono y endurece el verificador.

El repo de pagos **no necesito cambios**: no tiene ninguna referencia `pi pi-*` en `src/`, no
declara `primeicons` y no tiene script verificador propio. Se reconstruyo y se corrio su suite
para confirmar que la regla de spinner de la iteracion anterior sigue sana.

### 21.5 Dos avisos del build que NO provienen del codigo

El build emite `Cannot find "tabler--file-pdf". Bad icon name?` e `Invalid icon name: "tabler--…"`.
Salen de los **artefactos de esta tarea**, no de `src/`: Tailwind escanea el proyecto y
`.agents/tasks/.../review.md` contiene esos dos literales como texto. Comprobado moviendo la
carpeta fuera del proyecto: el build pasa a **0 coincidencias** de avisos de icono, y vuelven al
restaurarla. Desapareceran al limpiar los artefactos. El primer mensaje es, de hecho, la prueba
independiente de que `tabler--file-pdf` no existe (seccion 21.1).

### 21.6 Sigue NO VERIFICADO VISUALMENTE

Sin cambios respecto de las secciones 14 y 20: no hay navegador en el entorno y las pantallas
estan detras de autenticacion. De esta iteracion queda sin ver en pantalla:

- el render y la alineacion real de los 11 iconos Tabler dentro de su boton
- que el hueco flex de 0.5rem efectivamente desaparecio al llenarse el span
- el "Ver PDF" del visor a 320/390 px con el icono presente

Lo verificado numericamente: la existencia de cada clase en el CSS compilado (una regla por
clase), la ausencia total de reglas `.pi-*` y el contrato estatico del verificador.
