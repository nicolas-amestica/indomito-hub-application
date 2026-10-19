# Auditoría de solo lectura — comprobantes + correcciones de UI

Alcance auditado:

- Backend Go `ind-hub-api-gox-sls-pri-gh`, commit `f008522` (diff `652f834..f008522`).
- Frontend `ind-hub-app-ngx-pri-gh`, commits `26b8328`, `f2de0db`, `603ce09` (diff `a7ccebc..603ce09`).
- Estándar de referencia: `docs/standards/frontend/design-system-usage.md`, `ui-patterns.md` y la sección "Arquitectura Frontend" del `AGENTS.md`.

No se modificó ningún archivo del código fuente. Se ejecutaron builds y tests (no alteran fuentes) y se generó un PDF de muestra en `/tmp`.

---

## Resumen ejecutivo

El backend (item 1) está **bien resuelto y verificado visualmente**. El frontend tiene **dos defectos graves introducidos por los propios commits de esta tarea**, ninguno de los cuales fue detectado por build, tests ni por el script `check:buttons`:

1. **Cuatro botones quedaron completamente vacíos** (sin texto ni icono). El commit `26b8328` convirtió `<p-button label="…" icon="…">` (componente) en `<button pButton label="…" icon="…">` (directiva), pero la directiva `pButton` de PrimeNG 22 **no tiene inputs `label` ni `icon`**. Son atributos HTML inertes y los botones no tienen contenido hijo.

2. **El cambio de `severity="secondary"` a `severity="contrast"` deja el texto de 11 botones con contraste 1.00:1 en modo oscuro** (literalmente invisible). El repo ya tenía una corrección de modo oscuro para `outlined-secondary` en `src/styles.css:98-101`; `contrast` no la tiene y cae en los tokens de Aura, que en modo oscuro resuelven el color del texto al mismo valor que el fondo del panel. El item 2d, que era precisamente la queja de modo oscuro del usuario, quedó peor que antes.

Además, el diagnóstico del doble spinner era correcto pero **`src/styles.css` nunca se modificó**: la regla global sigue sin acotar en la línea 129, de modo que el problema queda latente para cualquier `<p-button [loading]>` futuro.

### Tabla de dictámenes

| # | Item | Dictamen |
|---|------|----------|
| 1 | Backend: comprobantes con header ondeado + bajada de título | **CUMPLE** (verificado visualmente) |
| 2a | contract-list: líneas de tabla suavizadas | **CUMPLE** (mecánicamente; no verificado visualmente) |
| 2b | contract-list: celda de acciones ya no se descuadra | **CUMPLE** (causa raíz correctamente atacada) |
| 2c | contract-list: contraste de los 3 botones en modo claro | **CUMPLE** (17.04:1) |
| 2d | contract-list: contraste de "Anexos" en modo oscuro | **NO CUMPLE** — empeoró a 1.00:1 |
| 3 | Un solo spinner en todos los botones | **PARCIAL** — resuelto de hecho, pero con regresión y sin acotar la regla global |
| 4a | Todos los botones del proyecto son PrimeNG | **PARCIAL** — todos usan PrimeNG, pero 4 renderizan vacíos |
| 4b | contract-form: líneas de "Historial de versiones firmadas" | **CUMPLE** (mecánicamente) |
| 4c | Dialog "Ver PDF": responsive, contraste y borde | **PARCIAL** — responsive y borde sí; contraste roto en oscuro |
| 5a | group-deposit: placeholders faltantes | **CUMPLE** |
| 5b | group-deposit: borde del panel del datepicker | **CUMPLE** (mecánicamente) |
| 6 | meeting-hosts: botones de la última columna | **PARCIAL** — mejora plausible, pero el mismo archivo quedó con un botón vacío |

---

## Evidencia

### Item 1 — Backend: comprobantes con arte ondeado y bajada de título · CUMPLE

Único item verificado de forma visual y ejecutable.

**Arte compartido real, no barra dibujada por código.** Se creó `libs/pdfbrand/pdfbrand.go` con las imágenes embebidas y ambos consumidores las usan:

```go
// libs/pdfbrand/pdfbrand.go:27-37
func DrawHeader(pdf *gopdf.GoPdf) {
    if holder, err := gopdf.ImageHolderByBytes(headerPNG); err == nil {
        _ = pdf.ImageByHolder(holder, -8, 0, &gopdf.Rect{W: 632, H: HeaderHeight})
    }
}
```

Los PNG son los mismos archivos que usaba el contrato: el diff los registra como renombrados, no copiados —
`{services/api-contract/functions/assets => libs/pdfbrand}/header.png | Bin`. `services/api-contract/functions/pdf.go:196-200` pasó a llamar `pdfbrand.DrawHeader/DrawFooter`, así que contrato y comprobante comparten literalmente el mismo arte. Antes el comprobante dibujaba una barra recta por código, que fue eliminada:

```go
// services/payment-receipts/functions/document.go — líneas eliminadas
-	pdf.SetFillColor(28, 28, 28)
-	pdf.RectFromUpperLeftWithStyle(0, 0, 595, 112, "F")
-	writePDFText(pdf, "bold", 21, 235, 255, 0, 48, 36, "GIRAS INDÓMITO")
```

**Bajada de título presente** en `services/payment-receipts/functions/document.go:19` y renderizada centrada en la línea 73:

```go
receiptTagline   = "Dale una vuelta a la aventura"
...
writeCenteredPDFText(pdf, "regular", 12, 255, 255, 255, receiptPageWidth/2, 84, receiptTagline)
```

**Cubre los tres flujos.** Hay un único camino de render: `renderReceipt` (`document.go:61`), invocado solo desde `worker.go:72`. Cuota, abono y abono grupal se diferencian únicamente en el texto del concepto (`document.go:89-95`), de modo que los tres heredan el header/footer nuevo.

**Verificación ejecutada.** `go build ./...` y `go test ./...` pasan en `libs`, `services/payment-receipts` y `services/api-contract`. Además generé un comprobante real con el fixture existente (`RENDER_RECEIPT_PATH=/tmp/audit-receipt.pdf go test ./functions -run TestRenderReceiptFixture`) y lo inspeccioné como PNG: se ve la barra ondeada superior, el logo, la bajada "Dale una vuelta a la aventura" en blanco sobre la zona oscura, "Comprobante de registro de pago" debajo, y el pie de página idéntico al del contrato. No hay solapamientos ni texto fuera del área oscura, y el reflow de coordenadas (QR a 612, código de verificación a 698/708, pie a 806) no colisiona con el footer que ocupa 718-792.

Observación menor, no un incumplimiento: la bajada se dibuja con la fuente Courier del documento, no con la tipografía de marca del logo.

### Item 2a — Líneas de la tabla suavizadas · CUMPLE (mecánicamente)

Cada `<th>` y `<td>` recibió el token correcto, en `contract-list.page.html:103-171`:

```html
<th class="border-line/75! dark:border-line/55!">Cotización</th>
```

Coincide con el estándar (`border-line/75` en claro, `dark:border-line/55` en oscuro), incluye los separadores internos y el `emptymessage`. No se usaron selectores globales ni se sobrescribieron tokens del preset, así que respeta las prohibiciones del charter. Pendiente solo la comprobación visual.

### Item 2b — Celda de acciones descuadrada · CUMPLE

La causa raíz estaba bien identificada y bien atacada. Antes el `<td>` llevaba `class="flex items-center justify-end gap-3"`: `display:flex` sobre un `<td>` destruye el `display: table-cell`, y con ello el borde inferior de la celda deja de alinearse con el de la fila — exactamente el síntoma reportado. Ahora el `<td>` conserva su display nativo y el flex vive en un hijo (`contract-list.page.html:143-145`):

```html
<td class="border-line/75! dark:border-line/55!">
  <div class="flex flex-wrap items-center justify-end gap-2">
```

Refuerzos adicionales: `min-width` de la tabla subió de `58rem` a `64rem` con `[scrollable]="true"`, y la tabla está oculta bajo `md` (`hidden md:grid`), con tarjetas para móvil. En anchos intermedios la tabla hace scroll horizontal en lugar de comprimir la celda, de modo que el escenario del descuadre ya no se produce.

### Item 2c — Contraste de los 3 botones en modo claro · CUMPLE

Los tres pasaron a la misma combinación (`size="small" severity="contrast" outlined`), lo que además satisface la regla de acciones adyacentes con misma jerarquía. En particular el tercero, que antes era un enlace de texto artesanal, ahora es un botón PrimeNG:

```html
<!-- antes -->
-<a [routerLink]="…" class="text-sm font-semibold text-brand-active">
<!-- ahora: contract-list.page.html:169-175 -->
<a pButton size="small" severity="contrast" outlined [routerLink]="['/contratos', contract.id, 'editar']">
```

En modo claro, `outlined contrast` resuelve el color del texto a `{surface.950}` → `var(--color-ink)` → `#1c1c1c` sobre `#ffffff`: **17.04:1**, muy por encima de AA.

Inconsistencia menor que queda abierta: en la tarjeta móvil (`contract-list.page.html:82-84`) el tercer botón quedó sin `severity` ni `outlined`, es decir primary amarillo relleno, junto a dos `contrast outlined`. El escritorio y el móvil no representan la misma jerarquía con la misma variante.

### Item 2d — Contraste de "Anexos" en modo oscuro · NO CUMPLE (empeoró)

Este es el segundo defecto grave. El cambio a `severity="contrast"` abandona una corrección de modo oscuro que el repo ya tenía y cae en tokens de Aura que fallan.

El repo fija explícitamente los tokens oscuros de `outlined-secondary` en `src/styles.css:98-101`, dentro del bloque `.dark`:

```css
--p-button-outlined-secondary-color: #d4d4d8;
--p-button-outlined-secondary-border-color: #71717a;
```

**No existe ningún equivalente para `contrast`**: `grep -n "button" src/app/core/theme/indomito.preset.ts` no devuelve nada (el preset no personaliza el componente button) y en `styles.css` solo están las cuatro líneas de `outlined-secondary`. Por lo tanto `contrast` resuelve por los tokens de Aura (`node_modules/@primeuix/themes/dist/aura/button/index.mjs`):

```js
contrast: { borderColor: "light-dark({surface.700}, {surface.500})",
            color:       "light-dark({surface.950}, {surface.0})" }
```

El preset mapea `surface.0: 'var(--color-surface)'` (`indomito.preset.ts:26`). Y el modo oscuro **sí** cambia `color-scheme`, en dos lugares, así que `light-dark()` toma la segunda rama:

- `src/styles.css:107` → `color-scheme: dark;`
- `src/app/core/theme/theme.service.ts:31` → `this.document.documentElement.style.colorScheme = dark ? 'dark' : 'light';`

Encadenando: texto = `{surface.0}` = `var(--color-surface)` = `#1b1c1f` en oscuro (`styles.css:47`), sobre un panel `bg-surface` que es ese mismo `#1b1c1f`.

| Combinación en modo oscuro | Ratio |
|---|---|
| Texto `outlined contrast` (#1b1c1f) sobre panel `bg-surface` (#1b1c1f) | **1.00:1** |
| Texto `outlined contrast` (#1b1c1f) sobre `bg-canvas` (#111214) | **1.10:1** |
| Borde (#a1a1aa) sobre panel | 6.65:1 |
| Patrón abandonado `outlined-secondary` (#d4d4d8) sobre panel | 11.53:1 |

El resultado visible en modo oscuro es un recuadro con borde y **sin etiqueta legible**. El patrón que se abandonó daba 11.53:1.

**Radio de impacto.** Las 11 apariciones de `severity="contrast"` fueron introducidas por estos commits (en `a7ccebc` no existía ninguna) y todas son `outlined` o `text`, por lo que todas comparten el defecto:

```
src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html:233, 272
src/app/indomito-hub/contracts/pages/contract-list/contract-list.page.html:70, 78, 152, 163, 172
src/app/shared/documents/components/document-preview-dialog/document-preview-dialog.component.html:19, 67, 76, 80
```

**Qué habría que cambiar.** Dos opciones coherentes con el estándar: (a) volver a `severity="secondary" outlined`, que ya tiene la corrección oscura, y arreglar el contraste de modo claro ajustando `--p-button-outlined-secondary-color` para claro en lugar de cambiar de severity; o (b) mantener `contrast` y añadir en el bloque `.dark` de `styles.css` el par que falta, junto a las líneas 98-101:

```css
--p-button-outlined-contrast-color: #f4f4f5;        /* o var(--color-ink) */
--p-button-outlined-contrast-border-color: #71717a;
--p-button-text-contrast-color: #f4f4f5;
```

La opción (b) también exige validar el modo claro, porque esas variables aplican a ambos temas si no se acotan al bloque `.dark`.

### Item 3 — Doble spinner · PARCIAL

Hay que separar tres cosas: el diagnóstico, el estado actual y el método del arreglo.

**El diagnóstico era correcto.** En PrimeNG 22.1.1 el componente `<p-button>` renderiza su propio spinner y además recibe la clase que activa la regla global:

```js
// primeng-button.mjs:406-411 — el componente sí renderiza spinner
@if ($loading()) { … <svg data-p-icon="spinner" [spin]="true" /> }
// primeng-button.mjs:41 — y además recibe la clase
'p-button-loading': loading || buttonProps?.loading,
```

Mientras la directiva (línea 704) marca `loading` como `@deprecated` y solo añade la clase, sin renderizar nada. Así que un `<p-button [loading]>` no icon-only mostraba el SVG propio **más** el `::before` global: dos spinners. Correcto.

**La regla global NO se acotó.** `src/styles.css` no aparece en ninguno de los tres commits, y la regla sigue sin condición en la línea 129:

```css
/* src/styles.css:129 */
button.p-button-loading::before { … animation: indomito-button-spin … }
/* src/styles.css:141 */
button.p-button-loading.p-button-icon-only > * { display: none; }
```

No hay `:not([data-pc-name="button"])` ni ningún otro acotamiento.

**Estado actual: no queda doble spinner, pero por eliminación del caso, no por arreglo de la regla.** Enumeré los 124 `[loading]` del repo. `<p-button>` (componente) solo se usa en dos archivos — `meet-calendar.page.html` y `meeting-hosts.component.html` — y **ninguna de esas instancias tiene ya `[loading]`**: las tres que lo tenían fueron convertidas a directiva. Resultado por tipo:

| Caso | Spinners | Motivo |
|---|---|---|
| `<button pButton [loading]>` con texto | 1 | la directiva no pinta nada; solo el `::before` global |
| `<button pButton iconOnly [loading]>` (inbox) | 1 | `p-button-icon-only` oculta los hijos y queda el `::before` |
| `<p-button [loading]>` | — | no existe ninguno hoy |

No quedan spinners manuales dentro de botones. Los cuatro `p-progress-spinner` / `animate-spin` que hay son estados de carga de página, fuera de cualquier botón: `favorites-panel.component.html:55`, `preview-dialog.component.html:338`, `program-form.page.html:159`, `iam-admin.page.html:87`.

**El riesgo queda latente.** Como la regla global no se acotó, el primer `<p-button [loading]>` que alguien añada volverá a mostrar dos spinners. El arreglo robusto es acotar la regla, no evitar el componente.

**Ruido introducido.** El commit `26b8328` también **añadió** `[loading]="busy()"` a cuatro botones de `renditions.page.html` (líneas 74, 95, 114, 157) que solo tenían `[disabled]`. Eso agrega spinners donde no había; satisface la regla del script `check:buttons` ("falta [loading] para el estado en curso") pero no corresponde a lo que pidió el usuario.

**`ind-pay-app-ngx-pri-gh` tiene el problema inverso.** Usa `primeng ^22.1.1` y tiene 12 usos de `[loading]`, todos sobre la directiva, pero **no tiene ninguna regla CSS de spinner** (`grep -rn "p-button-loading" src/` → sin resultados; `grep -rn "spin" src/styles.css` → sin resultados). Es decir, en el portal de pagos esos botones **no muestran ningún spinner**. No estaba en el pedido original del usuario, pero es un defecto real del mismo patrón.

### Item 4a — Todos los botones PrimeNG · PARCIAL

**Lo que sí está bien.** Hice un barrido propio a nivel de etiqueta (no por línea, porque las etiquetas se parten en varias líneas y un grep por línea da falsos positivos):

- `<button>` sin `pButton` en todo `src/` incluyendo plantillas inline de `.ts`: **0**.
- `<a>` con `(click)` sin `pButton`: **1**, en `app-mega-menu.component.html:80`, y es un `<a [routerLink]>` de navegación con estilo de tarjeta, no un botón. Excepción legítima.
- Los `<a>` con apariencia de botón usan `pButton` correctamente (20 casos, p. ej. `contract-list.page.html:10, 84`).
- `role="button"` sobre `div`/`span`: 0.
- En `contract-form.page.html` concretamente, todos los botones son PrimeNG. Esa parte del item se cumple.

**Lo que está mal: cuatro botones renderizan vacíos.** La directiva `pButton` de PrimeNG 22.1.1 **no declara `label` ni `icon`**. Su lista completa de inputs es `pButton, pButtonPT, pButtonUnstyled, hostName, text, plain, raised, size, outlined, link, rounded, fluid, variant, iconOnly, loading, severity` (`primeng-button.mjs:771`). La etiqueta y el icono se pasan como hijos de contenido vía `ButtonLabel`/`ButtonIcon`:

```js
iconSignal  = contentChild(ButtonIcon,  { descendants: false });
labelSignal = contentChild(ButtonLabel, { descendants: false });
```

Por tanto `label="Guardar"` e `icon="pi pi-check"` son atributos HTML inertes. Verifiqué el contenido interior de cada `<button pButton>` que los lleva, y exactamente los cuatro tocados por `26b8328` están vacíos:

```
EMPTY        meeting-hosts.component.html:85    inner=""
EMPTY        meet-calendar.page.html:16         inner=""
EMPTY        meet-calendar.page.html:111        inner=""
EMPTY        meet-calendar.page.html:114        inner=""
has-content  contract-form.page.html:505        inner="Agregar representante"
has-content  inbox-shell.page.html:114          inner="<span class=\"icon-[tabler--send] …\">"
…
```

Los demás casos con `icon=` inerte (contract-form, inbox, app-shell, iam-admin) **sí tienen hijo visible**, así que el atributo sobra pero no rompe nada. Los cuatro de arriba no tienen hijo:

```html
<!-- meeting-hosts.component.html:85 — era <p-button> y funcionaba -->
<button pButton type="submit" label="Guardar" icon="pi pi-check" [loading]="saving()" [disabled]="saving()"></button>
```

Es una regresión directa: "Guardar" del diálogo de anfitriones, y "Refrescar", "Eliminar" y "Guardar" de `meet-calendar`, son hoy botones en blanco.

**Qué habría que cambiar.** Revertir esos cuatro a `<p-button label="…" icon="…">` (y acotar la regla global de spinner, que es el arreglo correcto del item 3), o bien darles contenido de directiva:

```html
<button pButton type="submit" [loading]="saving()" [disabled]="saving()">
  <span pButtonIcon class="pi pi-check" aria-hidden="true"></span>
  <span pButtonLabel>Guardar</span>
</button>
```

**El script `check:buttons` no puede detectar nada de esto.** Leí `tools/check-button-policy.mjs`. Solo comprueba dos cosas, y da `OK` hoy:

- Recorre **únicamente** `.html` bajo `src/app`: no ve plantillas inline en `.ts`, ni nada fuera de `src/app`.
- Solo inspecciona etiquetas `<button`: **no mira `<a>`**, ni `role="button"`, ni `div`/`span` con `(click)`.
- Valida que exista `pButton` y que haya `[loading]` si hay `[disabled]` con un estado en curso. **No valida que el botón tenga contenido visible**, ni que los atributos usados existan como inputs de la directiva.

Es decir, puede dar OK con botones vacíos o con anclas-botón nativas. Build (`ng build`: correcto), 441 tests (`vitest run`: 90 archivos, todos pasan) y `check:buttons` pasan los tres, y ninguno detecta los cuatro botones en blanco.

### Item 4b — Líneas de "Historial de versiones firmadas" · CUMPLE (mecánicamente)

`contract-form.page.html:255-291` aplica el token correcto a cabecera, celdas y mensaje vacío de esa tabla:

```html
<th class="border-line/75! dark:border-line/55!">Fecha</th>
…
<td class="border-line/75! dark:border-line/55!">{{ document.uploadedBy }}</td>
```

La vista de tarjetas móvil equivalente (línea 225) ya usaba `border border-line/75 dark:border-line/55`. Consistente con el estándar; falta la comprobación visual.

### Item 4c — Dialog de "Ver PDF" · PARCIAL

**Responsive: mejorado.** En `document-preview-dialog.component.html` y `document-preview.service.ts`:

- `h-[min(92vh,900px)]` → `h-[min(92dvh,900px)]` (línea 1), que evita el recorte por la barra de direcciones en móvil.
- Los botones del pie pasan a apilarse en vertical en móvil (línea 75): `flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3`. Antes era `flex flex-wrap` siempre, que es lo que los dejaba fuera de vista.
- `min-h-[420px]` → `min-h-60` en el iframe (línea 49), para que a 320 px el pie entre en pantalla.
- `breakpoints: { '960px': '95vw', '640px': '95vw' }` en lugar de `100vw` a 640 px, de modo que el borde del diálogo se ve en móvil.

**Borde suavizado: correcto y sin violar las prohibiciones.** `document-preview.service.ts:15` añade `styleClass: 'border! border-line/75! dark:border-line/55!'`. Verifiqué que `styleClass` es un input real de la configuración de `DynamicDialog`. Es una clase por instancia, no un selector global ni una sobrescritura de tokens del preset, así que respeta el estándar. Los separadores internos (header línea 3, nav línea 29, footer línea 55) ya usaban `border-line/75 dark:border-line/55`.

**Contraste: NO resuelto en modo oscuro.** Cuatro botones del diálogo usan `severity="contrast"` y heredan el defecto del item 2d, con 1.00:1 en oscuro:

- línea 19 — botón de cerrar (la "X"), variante `text`; `text.contrast.color` también es `light-dark({surface.950}, {surface.0})`, así que el icono de cerrar queda invisible en oscuro.
- línea 67 — "Seguir revisando".
- línea 76 — "Descargar".
- línea 80 — "Cerrar".

**El hallazgo abierto del revisor anterior se confirma.** Los spans de icono manual existen y están ubicados:

- `contract-list.page.html:157` → `<span class="pi pi-file-pdf" aria-hidden="true"></span>` dentro del botón "Ver PDF" de la última columna.
- `contract-form.page.html:164` → el mismo span en "Ver copia firmada vigente".
- En el propio diálogo: línea 23 (`pi pi-times`), 77 (`pi pi-download`), 89 (`[class]="options.primaryAction.icon"`).

Matiz importante: con la directiva de PrimeNG 22 un icono hijo es el mecanismo soportado, así que no es un "botón artesanal". Pero la forma canónica es marcarlo con la directiva (`<span pButtonIcon class="pi pi-file-pdf">`), y sin ella PrimeNG no le aplica la clase `p-button-icon` ni su control de espaciado. Hay además una inconsistencia entre acciones equivalentes: "Ver PDF" lleva icono en `contract-list.page.html:157` pero no en `contract-form.page.html:239` ni `:278`, y en la tarjeta móvil de contract-list tampoco.

**Estructura/patrón: correcta.** `src/app/shared/documents/` separa `components/`, `interfaces/` (`document-preview.interface.ts`) y `services/`. Las interfaces no viven dentro del componente. No se requieren `types/` ni `constants/` aquí.

### Item 5a — Placeholders de group-deposit · CUMPLE

Los cinco controles de entrada de la página tienen placeholder. No queda ninguno sin él:

| Línea | Control | Placeholder | Origen |
|---|---|---|---|
| 57-63 | `p-inputnumber` monto | `Ej. 150.000` | agregado |
| 76-80 | `p-datepicker` fecha efectiva | `DD-MM-YYYY` | preexistente |
| 99-104 | `input pInputText` referencia | `Ej. N.º de operación 123456789` | preexistente |
| 122-129 | `input pInputText` correo | `Ej. nombre@correo.cl` | agregado |
| 140-146 | `textarea` motivo | `Ej. Transferencia verificada en la cartola del banco` | agregado |

El `p-checkbox` de la línea 156 no admite placeholder ni lo necesita. La afirmación del implementador (monto, correo, motivo) es exacta.

### Item 5b — Borde del panel del datepicker · CUMPLE (mecánicamente)

`group-deposit.page.html:84`:

```html
panelStyleClass="border! border-line/75! dark:border-line/55!"
```

Verifiqué que `panelStyleClass` **es un input declarado** del datepicker de PrimeNG 22 (`primeng-datepicker.mjs`), así que no es un atributo inerte como `label`/`icon`. No es CSS global sobre formularios ni sobrescritura de tokens del preset, de modo que cumple las prohibiciones del charter, y usa el mismo token `line` que el resto.

Salvedad de consistencia: es la **única** aparición de `panelStyleClass` en todo el repo. Los demás overlays de datepicker/select de otras páginas siguen con el borde fuerte, y el diálogo de `meeting-hosts` resuelve lo mismo de otra forma (`styleClass="dark:border-line/55!"`, solo modo oscuro). No hay un patrón compartido; es un parche puntual, que es lo que el item pedía, pero no deja el repo consistente.

### Item 6 — Botones de la última columna en meeting-hosts · PARCIAL

El diff es de 6 líneas en el `.html` y 4 en el `.ts`. Lo que cambió en la última columna (`meeting-hosts.component.html:36-37`):

```html
-<p-button ariaLabel="Editar anfitrión"   icon="pi pi-pencil" [text]="true"     severity="secondary" (onClick)="open(host)" />
-<p-button ariaLabel="Eliminar anfitrión" icon="pi pi-trash"  [text]="true"     severity="danger"    (onClick)="remove(host)" />
+<p-button ariaLabel="Editar anfitrión"   icon="pi pi-pencil" [outlined]="true" size="small" severity="secondary" (onClick)="open(host)" />
+<p-button ariaLabel="Eliminar anfitrión" icon="pi pi-trash"  [outlined]="true" size="small" severity="danger"    (onClick)="remove(host)" />
```

**¿Es suficiente?** Para el problema de visibilidad, plausiblemente sí, y por una razón concreta: son el componente `<p-button>`, donde `icon` **sí** es un input válido, así que el icono se renderiza. Al pasar de `text` a `outlined` ganan borde visible, y `outlined-secondary` es precisamente la severity que el repo corrige para modo oscuro en `styles.css:98-101` (11.53:1). Es decir, aquí se usó el patrón que funciona — justo el que se abandonó en contract-list. Variante y tamaño quedan iguales entre ambos; la diferencia de severity (secondary vs danger) es semántica y está permitida. No verificado visualmente.

**Pero el mismo archivo quedó con una regresión.** La línea 85, tocada por `26b8328`, dejó el botón "Guardar" del diálogo completamente vacío (ver item 4a). En un item cuyo enunciado era "los botones no se ven", se arreglaron dos botones y se dejó un tercero invisible por falta de contenido.

Observación fuera de alcance, preexistente, no introducida por estos commits: `meeting-hosts.component.html:67` aplica `class="w-32 uppercase"` a un `input pInputText`. `uppercase` es una clase tipográfica heredable sobre un control PrimeNG, lo que el charter prohíbe.

---

## Discrepancias entre lo afirmado y lo que está en el código

1. **"La causa era la regla global `button.p-button-loading::before` en `src/styles.css`."** El diagnóstico es correcto y lo confirmé en el código de PrimeNG. Pero `src/styles.css` **no fue modificado en ninguno de los tres commits**, y la regla sigue sin acotar en la línea 129, igual que `button.p-button-loading.p-button-icon-only > * { display: none }` en la 141. El doble spinner desapareció porque se eliminaron todos los `<p-button [loading]>`, no porque se corrigiera la causa. El defecto queda latente.

2. **El arreglo del spinner introdujo cuatro botones vacíos.** Convertir `<p-button label="…" icon="…">` en `<button pButton label="…" icon="…">` asume inputs que la directiva de PrimeNG 22 no tiene. Nadie lo detectó porque `ng build`, los 441 tests y `check:buttons` pasan los tres. Afecta `meeting-hosts.component.html:85` y `meet-calendar.page.html:16, 111, 114`.

3. **`severity="contrast"` se presentó como la corrección de contraste y es la causa de un fallo peor en modo oscuro.** El repo ya tenía resuelto el modo oscuro para `outlined-secondary` (`styles.css:98-101`); `contrast` no tiene equivalente, no está en el preset, y cae en tokens de Aura que con `color-scheme: dark` resuelven el color del texto a `var(--color-surface)`, el mismo color del panel: **1.00:1**. Las 11 apariciones de `contrast` fueron introducidas por estos commits y todas son `outlined` o `text`. El item 2d, que era literalmente la queja de modo oscuro, quedó peor que antes.

4. **Coherencia interna del propio trabajo.** En `meeting-hosts` (item 6) se usó `outlined secondary`, que sí funciona en oscuro; en `contract-list` y en el diálogo se usó `outlined contrast`, que no. Dos criterios distintos para el mismo problema en la misma tanda de commits.

5. **Cambios no pedidos dentro del alcance auditado.** `26b8328` añadió `[loading]="busy()"` a cuatro botones de `renditions.page.html` (74, 95, 114, 157) que no tenían spinner alguno. No es parte de "que solo muestren 1 spinner".

---

## Lo que no pude verificar

- **Todo lo visual, responsive y de "suavidad" percibida de bordes del frontend: NO VERIFICADO VISUALMENTE.** No hay automatización de navegador en el entorno: `node_modules/.bin` no contiene playwright, puppeteer ni chromium. Sin ella no puedo capturar pantallas a 320 px, 390 px, tablet y escritorio en modo claro y oscuro, y levantar el dev server no aportaría evidencia comprobable. Quedan por tanto sin confirmación visual los items **2a, 2b, 4b, 5b** y la parte responsive del **4c**, además de la mejora de visibilidad del **6**. Los dictámenes de esos items se basan en que el mecanismo CSS/estructural es correcto y usa los tokens del estándar, no en haberlos visto.

  Excepción: los dictámenes de contraste (**2c, 2d** y el contraste del **4c**) y los cuatro botones vacíos del **4a** sí son concluyentes sin navegador, porque se derivan de resolver la cadena de variables CSS y los tokens de PrimeNG a valores numéricos y del contrato de inputs de la directiva.

- **El PDF de comprobante se verificó en un solo caso**: `DocumentVersion = 3`, concepto "Pago de cuota recibido", ambiente DEV. No rendericé el camino `Version != 3` (que usa `writeWrapped` en y=580 en lugar del bloque QR) ni los textos de abono y abono grupal. Comparten el mismo `renderReceipt` y solo cambia el texto del concepto, así que el riesgo de solapamiento es bajo, pero no está comprobado.

- **No comparé el PDF del contrato lado a lado con el comprobante.** Confirmé que ambos invocan `pdfbrand.DrawHeader/DrawFooter` sobre los mismos PNG renombrados, lo que hace la identidad del arte una certeza estructural, pero no generé un contrato para compararlos visualmente.

- **No ejecuté build ni tests de `ind-pay-app-ngx-pri-gh`.** La conclusión sobre su falta de spinner se basa en la ausencia de reglas CSS (`grep` sin resultados) y en el comportamiento documentado de la directiva, no en ejecución.

---

## Recomendaciones, por prioridad

1. **Revertir o corregir los cuatro botones vacíos** (`meeting-hosts.component.html:85`, `meet-calendar.page.html:16, 111, 114`). Es funcionalidad visiblemente rota hoy.

2. **Resolver el contraste de `contrast` en modo oscuro**, por cualquiera de las dos vías del item 2d, y aplicar un criterio único en todo el trabajo. Afecta 11 botones, entre ellos el de cerrar del visor de PDF.

3. **Acotar la regla global del spinner** en `src/styles.css:129` en lugar de evitar el componente `<p-button>`, para que ambos mecanismos puedan coexistir y el arreglo del item 3 sea real.

4. **Endurecer `tools/check-button-policy.mjs`**: que recorra también plantillas inline en `.ts`, que revise `<a>` con apariencia de botón, que exija contenido visible en cada botón y que rechace `label=`/`icon=` sobre la directiva `pButton`. Tal como está, dio OK sobre un repo con cuatro botones en blanco.

5. Menores: unificar `severity`/variante del tercer botón en la tarjeta móvil de `contract-list.page.html:82-84`; marcar los iconos hijos con `pButtonIcon`; homogeneizar la presencia del icono en los "Ver PDF" equivalentes; y decidir si `panelStyleClass` se generaliza a los demás overlays o se resuelve una sola vez en el sistema de diseño.
