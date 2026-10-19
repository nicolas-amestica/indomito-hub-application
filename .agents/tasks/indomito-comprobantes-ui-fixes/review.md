# Revisión — corrección de regresiones de UI (7 puntos), iteración 4

Revisión del working tree de `main` en los dos repos (`ind-hub-app-ngx-pri-gh`,
`ind-pay-app-ngx-pri-gh`) contra `auditoria.md`, `plan.md`, `verification.md` y el estándar de
diseño del orquestador. Esta tanda cierra los tres hallazgos bloqueantes/no bloqueantes que dejó
la revisión anterior: los once iconos `pi` inertes se migraron a Iconify/Tabler, y el verificador
estático ganó la regla R7 que cierra la clase de bug completa con una línea base de recuento
exacto. Los siete puntos del encargo quedan cumplidos y verificables sin pantalla: recalculé los
diez pares de contraste y coinciden al centésimo, confirmé el discriminador del spinner y el
input `type` en el bundle 22.1.1 instalado, comprobé que las once clases Tabler existen en el set
y emiten exactamente una regla cada una en el CSS compilado, y que no queda ninguna regla `.pi-*`.

**Watch for:** el `icon: 'pi pi-check-circle'` que `contract-form.page.ts:622` pasa como
`primaryAction.icon` sigue siendo un span fantasma dentro del botón "Aprobar contrato" del mismo
visor cuyos otros dos iconos sí se migraron (confirmado, preexistente de septiembre, diferido por
decisión del usuario), y el comentario de la línea base del verificador lo describe mal, como
icono del `confirmDialog` (confirmado); el *red* empírico del verificador no cubre las dos
extensiones de alcance nuevas —`<a pButton>` vacío y plantilla inline de `.ts`—, verificadas solo
por lectura (confirmado); nada se validó en pantalla, y el propio `verification.md` §21.6 lo
declara (confirmado).

**Verdict**: APPROVED

## Vista de alto nivel

El punto 1 está cerrado por regla, no por inspección: los cuatro botones vacíos volvieron al
componente `<p-button label icon>` con `(onClick)` y, en los dos de formulario, `type="submit"`,
que es un input real del componente y se emite como `[attr.type]`. El verificador pasa en verde y
su R3 recorre `<button>` y `<a>`, en `.html` y en plantillas inline de `.ts`.

El contraste del punto 2 cumple AA holgadamente en ambos temas para `outlined` y `text`:
recalculé los diez pares sobre los fondos reales de cada tema y obtuve los mismos valores
reportados. El mecanismo es legítimo: PrimeNG está configurado con `cssLayer: 'primeng'`, así que
la declaración `:root` sin capa que suaviza el borde en claro gana por cascada de capas, no por
orden de fuente.

El punto 3 descansa en un discriminador que existe de verdad en 22.1.1: el `<button>` interno del
componente emite `[attr.data-p]` y el host de la directiva declara solo `class` y `style`. El
spec nuevo monta los dos mecanismos en estado de carga y afirma el discriminador en lugar de
contar píxeles, que es lo correcto bajo jsdom.

Los cuatro `[loading]` ruidosos de `renditions` están revertidos y la línea 41, preexistente,
intacta. El verificador del punto 5 pasó de dos reglas a siete con red/green registrado, y la
regla nueva R7 acota el inventario `pi` en las dos direcciones, de modo que no pueda crecer ni
aflojarse sin que falle. El portal de pagos recibe la misma regla acotada dentro de su
`@layer components`, con `currentColor` y sin tokens ajenos, y cubre sus 12 botones de directiva.

Del punto 7, (a), (c) y (d) están hechos; (b) se revirtió a propósito, porque `pButtonIcon`
colapsaba el botón a icon-only, y la reincidencia queda cerrada por R6 más dos tests. Lo que
queda abierto es deuda preexistente y explícitamente diferida: el borde de `outlined-secondary`
en claro a 1.28:1 y las nueve referencias `pi` heredadas, hoy bajo línea base.

<details>
<summary>Issues (4)</summary>

1. **`primaryAction.icon` con un icono `pi` inerte** (no bloqueante, preexistente, confirmado) —
   `contract-form.page.ts:622` pasa `'pi pi-check-circle'`, que
   `document-preview-dialog.component.html` renderiza como `<span [class]>` dentro del botón
   "Aprobar contrato". No renderiza y aporta el hueco flex de `gap`, junto a "Descargar" y
   "Cerrar", cuyos iconos sí se migraron en esta tanda. Viene de septiembre (`89802c6`), fuera del
   diff, pero conviene migrarlo con el resto de la deuda para que la fila del visor quede
   coherente.
2. **La línea base del verificador describe mal esa entrada** (no bloqueante, confirmado) —
   `LEGACY_PI_ICONS` anota `contract-form.page.ts` como "icon del confirmDialog de aprobación"
   cuando es el icono del botón primario del visor. El comentario es código de esta tanda y
   despista a quien triague la deuda después. Corregir el texto.
3. **Sin *red* empírico para las dos extensiones nuevas del verificador** (no bloqueante,
   confirmado) — el red registrado dispara con los cuatro `<button pButton>` vacíos y los
   `label=`/`icon=` inertes, pero no con un `<a pButton>` vacío ni con una plantilla inline de
   `.ts`. El barrido de archivos `.ts` sí está probado de rebote por la línea base de R7, que
   cuenta referencias dentro de `.ts`; la ruta `templateRegions` queda verificada solo por
   lectura. Agregar los dos casos al red cerraría el hueco de evidencia.
4. **Borde de `outlined-secondary` en claro a 1.28:1** (no bloqueante, preexistente, diferido) —
   bajo el 3:1 de WCAG 1.4.11. No lo introdujo esta tanda, el usuario eligió la opción B y las
   pestañas del visor ya reciben un arreglo por instancia. Registrado como deuda en
   `verification.md` §15.

</details>

<details>
<summary>Detalle punto por punto</summary>

### Punto 1 — ningún `pButton` sin contenido visible

Los cuatro sitios señalados por la auditoría (`meeting-hosts.component.html:85`,
`meet-calendar.page.html:16`, `:111`, `:114`) usan hoy el componente `<p-button>` con `label` e
`icon`, y el verificador en verde garantiza que no queda ninguno vacío en todo `src/app`: R3
recorre `<button>` y `<a>`, sobre `.html` y sobre los literales `template:` de `.ts`, con una sola
exención acotada y comentada —el velo de `side-drawer.component.html:2`, que exige
`[unstyled]="true"` **más** nombre accesible.

Dos cambios de contrato que había que comprobar y están bien: `(click)` pasó a `(onClick)`, que es
el output del componente, y `type="submit"` se conservó. Confirmé en
`node_modules/primeng/fesm2022/primeng-button.mjs` que `type` es un input real del componente y se
emite como `[attr.type]` (líneas 386 y 388), así que el envío del `<form>` de ambos diálogos sigue
funcionando. El import quedó alineado: `meeting-hosts.component.ts` perdió `ButtonDirective`, que
habría disparado `NG8113`.

La solución es consistente: en las dos barras de diálogo los tres botones (Cancelar / Guardar /
Eliminar) son ahora componente, y en la barra de `meet-calendar` los cuatro también.

### Punto 2 — contraste en ambos temas, sobre el fondo real

Recalculé los diez pares desde las variables resueltas de `src/styles.css` (`@theme static` para
claro, bloque `.dark` para oscuro), sin confiar en la tabla:

| Elemento | Fondo | Claro | Oscuro |
| --- | --- | --- | --- |
| Texto `outlined`/`text contrast` | `bg-surface` | 17.04:1 | 15.50:1 |
| Texto `outlined`/`text contrast` | `bg-canvas` | 16.31:1 | 17.05:1 |
| Borde `outlined contrast` | `bg-surface` | 3.69:1 | 3.53:1 |
| Borde `outlined contrast` | `bg-canvas` | 3.53:1 | 3.88:1 |
| Texto sobre hover | — | 16.31:1 | 11.13:1 |
| Texto sobre active | — | 15.49:1 | 9.40:1 |

Coinciden con `verification.md` al centésimo. Los fondos son los correctos: `#FFFFFF` / `#F9FAFB`
en claro y `#1B1C1F` / `#111214` en oscuro, que son los valores reales de `--color-surface` y
`--color-canvas` en cada tema. Ningún texto por debajo de 4.5:1 ni ningún borde por debajo de 3:1
en ninguno de los dos temas, para `outlined` ni para `text`; la variante `text` no tiene borde, así
que solo le aplica el mínimo de texto.

El mecanismo de claro merecía comprobación aparte, porque la justificación del comentario depende
de la configuración: `app.config.ts:48-51` declara
`cssLayer: { name: 'primeng', order: 'theme, base, primeng' }`, de modo que las variables del tema
viven en una capa y la declaración `:root` sin capa de `styles.css` gana por cascada de capas,
independientemente del orden de inserción del `<style>` en runtime. La afirmación del comentario es
correcta. En el CSS compilado hay exactamente dos apariciones de
`--p-button-outlined-contrast-border-color`, una en `:root` y una en `.dark`, y
`--color-control-border` vale `#858585` en claro y `#71717A` en oscuro, de donde salen los cuatro
ratios de borde.

El refuerzo del borde de las pestañas inactivas del visor se hizo por instancia
(`[class.border-control-border!]`), no por token global, y la clase `.border-control-border\!`
está emitida en el CSS compilado, así que no es marcado muerto. La acompaña `aria-current`, de
modo que el estado activo no depende solo del color.

### Punto 3 — un solo spinner en ambos mecanismos

El discriminador existe en el bundle instalado (`primeng` 22.1.1): el template del componente
lleva `[attr.data-p]="dataP()"` (líneas 400 y 454) y el `host` de `ButtonDirective` declara solo
`'[class]'` y `'[style]'` (líneas 779-782), nunca `data-p`. En el CSS compilado las dos reglas
publicadas son `button.p-button-loading:not([data-p]):before` y
`button.p-button-loading:not([data-p]).p-button-icon-only>*`, y en el de pagos las mismas dos.

`src/app/shared/ui/button-loading.spec.ts` monta los dos casos en estado `[loading]="true"` y
afirma, para el componente, un indicador propio más `data-p` con `loading`, y para la directiva,
cero indicadores propios y ausencia de `data-p`. Medir el discriminador en vez de contar píxeles
es la decisión correcta: jsdom no evalúa pseudo-elementos. La garantía que jsdom no puede dar —que
la hoja siga acotada— vive en R5 del script, que sí lee la hoja. El mismo spec añade dos casos de
ancho que cierran la reincidencia de `pButtonIcon`.

Este punto pesa más que antes de la tanda, porque el punto 1 reintrodujo cuatro
`<p-button [loading]>`: sin el acotamiento, esos cuatro mostrarían dos indicadores.

### Punto 4 — reversión del ruido de `renditions`

Los cuatro `[loading]="busy()"` de las líneas 74, 95, 114 y 157 ya no están; queda solo
`[disabled]="busy()"`. La línea 41, que tenía `[loading]` de antes de esta tanda, sigue intacta. La
regla que los exigía desapareció del verificador con la justificación correcta: ese input de la
directiva está `@deprecated` en PrimeNG 22 con la indicación de usar `disabled`.

### Punto 5 — verificador endurecido, red y green

El script implementa siete reglas. Las dos extensiones de alcance son verificables por lectura:
`sourceFiles` incluye `.ts`, `templateRegions` extrae los literales de `template:` conservando el
desplazamiento para reportar la línea real, y el bucle de etiquetas itera `['button', 'a']`.
`openTags` respeta las comillas, de modo que un `>` dentro de una expresión de Angular no corta la
etiqueta antes de tiempo. R4 está bien delimitada: `(?:^|[\s])\[?label\]?\s*=` no captura
`aria-label=`, `[attr.aria-label]=` ni `ariaLabel=`.

R7 es la pieza nueva y está bien diseñada: rechaza cualquier referencia `pi pi-*` por encima del
recuento declarado por archivo **y** falla también si un archivo listado tiene menos de las
declaradas, para que la línea base no se afloje. Cubre el hueco exacto que señaló la revisión
anterior: R4 solo vigila la directiva, así que `<p-button icon="pi …">` pasaba porque el input es
válido aunque el set no exista.

El red está registrado para R3/R4 con los cuatro botones vacíos y los ocho `icon=` inertes de
`contract-form`, para R5 desacotando la regla a mano, y para R7 reintroduciendo dos iconos `pi`.
Ejecuté el verificador como único spot-check: `Button policy: OK`, exit 0. Lo que el red no cubre
—un `<a pButton>` vacío y una plantilla inline de `.ts`— queda como hueco de evidencia, no como
defecto de código; el barrido de `.ts` está probado de rebote porque la línea base de R7 cuenta
referencias dentro de `contract-form.page.ts` y de dos especificaciones, y el script no pasaría en
verde si no las leyera.

### Punto 6 — portal de pagos

`ind-pay-app-ngx-pri-gh/src/styles.css` recibe las dos reglas acotadas dentro de
`@layer components` y la keyframe a nivel superior. Solo `currentColor` y las mismas unidades del
Hub; ningún color literal ni token que ese repo no tenga. Cubre sus 12 `[loading]` de directiva.
La única aparición de `<p-button` en ese repo es el comentario de la propia regla, así que el
`:not([data-p])` no cambia nada hoy y deja el contrato idéntico al del Hub.

### Punto 7 — menores

(a) El tercer botón de la tarjeta móvil de `contract-list` pasó a `severity="contrast" outlined`;
los tres botones de esa tarjeta comparten hoy severity, variante y variante de borde, igual que la
fila de escritorio.

(b) `pButtonIcon` solo queda en el spec que prueba el comportamiento de la librería. La reversión
es correcta: la directiva infiere `p-button-icon-only` con `!labelSignal() && iconSignal()` y el
repo no marca sus etiquetas con `pButtonLabel`, así que el atributo colapsaba el botón al ancho
cuadrado con el texto desbordando. El botón de cerrar del visor, que sí es icon-only, usa el input
`iconOnly` del host —input real de la directiva, confirmado en el bundle— en lugar del
`pButtonIcon` `@deprecated`. R6 y el test de ancho cierran la reincidencia.

(c) **Cumple.** Los cinco "Ver PDF" equivalentes (`contract-list` 75 y 162, `contract-form` 164,
239 y 279) usan el mismo span `icon-[tabler--file-type-pdf] size-4`. Y, a diferencia de la
iteración anterior, ahora renderizan: comprobé que el icono existe en
`@iconify-json/tabler/icons.json` —el nombre que indicaba la revisión previa, con `file-pdf`, **no
existe**, y el coder lo corrigió a `file-type-pdf` documentando por qué— y que el CSS compilado
emite exactamente una regla por cada una de las once clases Tabler de la tanda
(`file-type-pdf`, `check`, `refresh`, `plus`, `download`, `x`, `pencil`, `trash`, `chevron-left`,
`chevron-right`), con **cero** reglas `.pi-*` en toda la hoja. El `size-4` / `size-5` garantiza
dimensiones, así que el hueco flex de `gap` queda ocupado por el icono y no por aire.

(d) `uppercase` salió del `input pInputText` de `meeting-hosts.component.html:67` y el valor se
sigue persistiendo en mayúscula porque el componente normaliza con `toUpperCase()`. No queda
ninguna clase tipográfica heredable aplicada sobre un `pInputText` en `src/`.

### No verificado

Nada visual, responsive ni de "suavidad percibida" se validó en pantalla, y `verification.md`
§21.6 lo declara sin adornos: no hay navegador en el entorno y las pantallas están detrás de
autenticación. Mis dictámenes no dependen de verlo —salen de resolver tokens a valores numéricos,
del contrato de inputs del bundle instalado, del CSS compilado y del set de iconos instalado—,
pero siguen requiriendo una pasada manual del usuario: el render y la alineación de los once
iconos dentro de su botón, el peso percibido del borde a 3.69:1, el responsive del diálogo
"Ver PDF" a 320/390 px y el panel del datepicker de `group-deposit`.

No reejecuté build ni suites; los leí en `verification.md` §21.4 (Hub: build OK, 448 tests en 92
archivos, `check:buttons` OK; Pay: build OK, 55 tests en 8 archivos). El único comando que
ejecuté fue el verificador estático; el resto fueron lecturas, greps sobre el CSS ya compilado y
cálculos de contraste.

Un detalle operativo: los artefactos de esta tarea viven dentro del proyecto, así que Tailwind los
escanea y cualquier nombre de icono inexistente citado en prosa produce un aviso de build. Por eso
este documento evita escribir el nombre fallido en la forma de clase. Conviene limpiar
`.agents/tasks/` al cerrar.

</details>

<details>
<summary>Archivos revisados</summary>

Hub (`ind-hub-app-ngx-pri-gh`), working tree de `main`, sin commit:

- `src/styles.css` — `:root` con el borde `contrast` en claro; 7 variables `contrast` en `.dark`;
  acotamiento `:not([data-p])` de las dos reglas del spinner
- `tools/check-button-policy.mjs` — R1–R7, línea base `LEGACY_PI_ICONS` en dos direcciones,
  barrido de `.ts` inline y de `<a>`
- `meeting-hosts.component.html` / `.ts` — "Guardar" a componente, iconos a Tabler, `uppercase`
  fuera, `ButtonDirective` fuera de los imports
- `meet-calendar.page.html` — cuatro botones a componente/iconos Tabler, chevrones con nombre
  accesible
- `contract-list.page.html` — jerarquía del tercer botón móvil, icono Tabler en los dos "Ver PDF"
- `contract-form.page.html` — icono Tabler en tres equivalentes, ocho `icon=` inertes eliminados
- `renditions.page.html` — cuatro `[loading]` revertidos
- `document-preview-dialog.component.html` — `iconOnly`, iconos Tabler, borde de pestaña inactiva,
  `aria-current`
- `src/app/shared/ui/button-loading.spec.ts` (nuevo) — contrato de spinner y de ancho
- `document-preview-dialog.component.spec.ts` (nuevo) — borde, `aria-current`, nombre accesible

Pay (`ind-pay-app-ngx-pri-gh`), working tree de `main`, sin commit:

- `src/styles.css` — dos reglas acotadas del spinner y la keyframe

Diff completo: `git diff` en cada repo.

</details>
