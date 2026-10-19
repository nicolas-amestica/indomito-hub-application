# Plan de implementación — corrección de regresiones de UI (7 puntos)

Base: `.agents/tasks/indomito-comprobantes-ui-fixes/auditoria.md`.
Repos: `ind-hub-app-ngx-pri-gh` (Hub) y `ind-pay-app-ngx-pri-gh` (Pay), ambos en `main`,
checkout principal, sin worktrees, sin push. Backend Go no se toca.

## Hallazgos de verificación previos al plan

Los siguientes datos se comprobaron leyendo el código instalado y condicionan las decisiones.
No volver a investigarlos durante la implementación.

### Discriminador real componente vs. directiva en el DOM (necesario para el punto 3)

`node_modules/primeng/fesm2022/primeng-button.mjs`:

- El **componente** `<p-button>` renderiza internamente un `<button>` con
  `[attr.data-p]="dataP()"` (línea 400). Cuando `loading` es verdadero, `dataP()` incluye el
  término `loading`, por lo que el atributo `data-p` **siempre está presente** en ese caso.
  Además renderiza su propio indicador: `<svg data-p-icon="spinner" [spin]="true">` (línea 411).
- La **directiva** `[pButton]` declara en su host únicamente `class` y `style`
  (`host: { properties: { "class": "styleClass()", "style": "hostStyle()" } }`, línea 771).
  **No emite `data-p`** y no renderiza ningún indicador; solo agrega la clase
  `p-button-loading` (línea 732).

→ Discriminador a usar: **`:not([data-p])`**. No usar `[data-pc-name]` (no existe en este
bundle) ni descendencia de `p-button` (menos robusta).

### Contrato de inputs (necesario para el punto 1)

- La directiva `[pButton]` **no declara `label` ni `icon`** (lista completa de inputs en la
  línea 771: `pButton, pButtonPT, pButtonUnstyled, hostName, text, plain, raised, size,
  outlined, link, rounded, fluid, variant, iconOnly, loading, severity`). Esos atributos son
  HTML inerte.
- `pButtonIcon` y `pButtonLabel` están marcados `@deprecated` en esta versión
  ("will be removed in a future major release", líneas 500 y 560).
- El input `loading` de la directiva también está marcado `@deprecated` (línea 701:
  "Manage loading state with native `disabled` and a child spinner").

### Tokens de botón que PrimeNG realmente consume (necesario para el punto 2)

`node_modules/@primeuix/styles/dist/button/index.mjs` consume exactamente estas rutas de token
(verificado por grep), que se traducen a variables CSS `--p-button-…`:

```
button.outlined.contrast.color          → --p-button-outlined-contrast-color
button.outlined.contrast.border.color   → --p-button-outlined-contrast-border-color
button.outlined.contrast.hover.background  → --p-button-outlined-contrast-hover-background
button.outlined.contrast.active.background → --p-button-outlined-contrast-active-background
button.text.contrast.color              → --p-button-text-contrast-color
button.text.contrast.hover.background   → --p-button-text-contrast-hover-background
button.text.contrast.active.background  → --p-button-text-contrast-active-background
```

Valores de Aura (`@primeuix/themes/dist/aura/button`) para `contrast`:
`color: light-dark({surface.950}, {surface.0})`,
`borderColor: light-dark({surface.700}, {surface.500})`,
`hoverBackground: light-dark({surface.50}, {surface.800})`,
`activeBackground: light-dark({surface.100}, {surface.700})`.
El preset mapea `surface.0 → var(--color-surface)`, `surface.800 → var(--color-graphite)`,
`surface.950 → var(--color-ink)`, `surface.700 → var(--color-graphite)`.
En modo oscuro `--color-surface: #1B1C1F` y `--color-graphite: #D4D4D8`, de donde salen tanto
el texto invisible (1.00:1) como un hover casi blanco con texto casi blanco.

---

## Decisiones

### Punto 1 — los cuatro botones vacíos: volver a `<p-button label icon>`

**Decisión: revertir los cuatro sitios al componente `<p-button>` con `label` e `icon`.**
No usar la forma canónica de directiva con `<span pButtonIcon>` / `<span pButtonLabel>`.

Razones:

1. `pButtonIcon` y `pButtonLabel` están `@deprecated` en la versión instalada; adoptarlos como
   patrón del repo crea deuda inmediata.
2. En los dos archivos afectados los botones vecinos de la **misma jerarquía** ya son
   `<p-button>` (`meeting-hosts.component.html:84` "Cancelar"; `meet-calendar.page.html:11,12,13`
   y el "Cancelar" del diálogo). La regla del charter sobre acciones adyacentes exige el mismo
   componente y la misma combinación de variante/tamaño: volver al componente la satisface;
   mezclar directiva con `<p-button>` en la misma barra, no.
3. El componente renderiza su propio spinner, de modo que una vez acotada la regla global
   (punto 3) el estado `loading` queda correcto con **un** indicador y sin depender de CSS
   global para ser visible.

### Punto 2 — contraste: mantener `contrast` y completar el lado oscuro (vía b)

**Decisión: vía (b).** Se conservan las 11 apariciones de `severity="contrast"` y se agregan las
siete variables faltantes **dentro del bloque `.dark`** de `src/styles.css`, junto a las de
`outlined-secondary` que ya existen (líneas 97-100). No se toca el modo claro, no se modifica
`indomito.preset.ts`, no se introduce ningún selector global nuevo.

Por qué no la vía (a): `outlined-secondary` en modo **claro** resuelve su borde a
`{surface.200}` = `--color-line` = `#E2E3E5`, que sobre `#FFFFFF` da **1.30:1** — falla el
mínimo de 3:1 para borde. Arreglarlo exigiría sobrescribir tokens del preset **fuera** de
`.dark`, que es justamente lo prohibido salvo la excepción de la vía (b). `contrast` en claro ya
cumple todo (17.04:1 texto, 11.37:1 borde), así que el defecto es exclusivamente del lado oscuro.

Variables a agregar (valores alineados con los de `outlined-secondary` ya presentes):

```css
--p-button-outlined-contrast-color: #f4f4f5;
--p-button-outlined-contrast-border-color: #71717a;
--p-button-outlined-contrast-hover-background: #34353a;
--p-button-outlined-contrast-active-background: #3f4046;
--p-button-text-contrast-color: #f4f4f5;
--p-button-text-contrast-hover-background: #34353a;
--p-button-text-contrast-active-background: #3f4046;
```

Las de `hover`/`active` no son opcionales: sin ellas el fondo de hover en oscuro resuelve a
`{surface.800}` = `--color-graphite` = `#D4D4D8` (casi blanco) con texto `#F4F4F5`, es decir
~1.1:1 al pasar el mouse.

#### Ratios (WCAG, calculados sobre los valores reales de los tokens)

Mínimos exigidos: 4.5:1 texto, 3:1 borde.

Modo claro — sin cambios, solo documentación de que ya cumple:

| Elemento | Color | Fondo | Ratio |
| --- | --- | --- | --- |
| Texto `outlined contrast` / `text contrast` | `#1C1C1C` (`surface.950`→`--color-ink`) | `bg-surface` `#FFFFFF` | **17.04:1** ✓ |
| Texto `outlined contrast` / `text contrast` | `#1C1C1C` | `bg-canvas` `#F9FAFB` | **16.19:1** ✓ |
| Borde `outlined contrast` | `#3A3A3A` (`surface.700`→`--color-graphite`) | `#FFFFFF` | **11.37:1** ✓ |
| Borde `outlined contrast` | `#3A3A3A` | `#F9FAFB` | **10.80:1** ✓ |
| Texto sobre hover claro | `#1C1C1C` | `#F9FAFB` (`surface.50`) | **16.19:1** ✓ |

Modo oscuro — estado actual (defecto) y estado tras el cambio:

| Elemento | Color | Fondo | Ratio |
| --- | --- | --- | --- |
| Texto `contrast` **hoy** | `#1B1C1F` (`surface.0`→`--color-surface`) | `bg-surface` `#1B1C1F` | **1.00:1** ✗ |
| Texto `contrast` **hoy** | `#1B1C1F` | `bg-canvas` `#111214` | **1.10:1** ✗ |
| Fondo hover `contrast` **hoy** | texto `#1B1C1F` | `#D4D4D8` (`surface.800`) | 1.17:1 ✗ |
| Texto `contrast` **tras el cambio** | `#F4F4F5` | `#1B1C1F` | **15.66:1** ✓ |
| Texto `contrast` **tras el cambio** | `#F4F4F5` | `#111214` | **17.17:1** ✓ |
| Borde `contrast` **tras el cambio** | `#71717A` | `#1B1C1F` | **3.52:1** ✓ |
| Borde `contrast` **tras el cambio** | `#71717A` | `#111214` | **3.87:1** ✓ |
| Texto sobre hover oscuro | `#F4F4F5` | `#34353A` | **11.33:1** ✓ |
| Texto sobre active oscuro | `#F4F4F5` | `#3F4046` | **9.58:1** ✓ |

(Referencia: el patrón abandonado `outlined-secondary` en oscuro da 11.53:1; la vía elegida lo
supera y además mantiene el 17.04:1 del modo claro.)

### Punto 5 — regla de `[loading]` del script

**Decisión: eliminar** la regla "falta `[loading]` para el estado en curso" de
`tools/check-button-policy.mjs` y sustituirla por las comprobaciones estructurales nuevas. El
input `loading` de la directiva está `@deprecated` en PrimeNG 22.1 con la indicación explícita
de manejar el estado con `disabled`; una regla que lo exige empuja al repo en dirección
contraria a la librería y fue la causa directa del ruido del punto 4.

### Punto 7d — `uppercase` en el input de color

**Decisión: quitar `uppercase` de `class` en `meeting-hosts.component.html:67`, dejando `w-32`.**
No se agrega estilo equivalente ni wrapper. El valor persistido no cambia: el componente ya
normaliza con `` color: `#${raw.color.replace(/^#/, '').toUpperCase()}` ``
(`meeting-hosts.component.ts:87`) y el validador acepta ambas cajas
(`/^#?[0-9A-Fa-f]{6}$/`, línea 34). El único efecto es que, mientras se escribe, el campo
muestra la caja que teclea el usuario.

---

## Implementación

> Trabajar en el orden indicado: los pasos 1-2 producen la prueba *red* del script, que deja de
> ser demostrable una vez arreglados los botones vacíos.

### Fase A — Hub: endurecer el verificador y demostrar red

- [ ] 1. Endurecer `tools/check-button-policy.mjs`.
      Reescribir el script conservando su forma (Node puro, sin dependencias nuevas, salida por
      `console.error` + `process.exitCode = 1`). Cambios:
      (a) recorrer `.html` bajo `src/app` **y** plantillas inline en `.ts` (extraer el contenido
      de `template:` delimitado por backticks, calculando el número de línea real sobre el
      archivo completo);
      (b) escanear etiquetas `<button …>` y `<a …>` (hoy solo `<button`);
      (c) regla R1 (existente): `<button>` debe llevar `pButton`;
      (d) regla R2: `<a>` con `(click)=` debe llevar `pButton`, con una lista blanca explícita y
      comentada que incluya `src/app/.../app-mega-menu.component.html` (ancla de navegación con
      estilo de tarjeta, no botón);
      (e) regla R3 **contenido visible**: para cada `<button pButton>` / `<a pButton>`, extraer el
      contenido hasta su etiqueta de cierre y fallar si no hay ni texto no vacío (cuenta la
      interpolación `{{ … }}`) ni ningún elemento hijo, ignorando comentarios y espacios. Debe
      disparar en los cuatro sitios del punto 1;
      (f) regla R4 **atributos inertes**: fallar si sobre `<button pButton>` / `<a pButton>`
      aparece `label=`, `[label]=`, `icon=`, `[icon]=`, `iconPos=`, `badge=` o `loadingIcon=`.
      Usar límites que **no** capturen `aria-label=` ni `[attr.aria-label]=`;
      (g) **eliminar** la regla de `[loading]` (ver decisión del punto 5).
      Mensajes de violación en español, con `archivo:linea` y causa.
      Files: `tools/check-button-policy.mjs`
      Verify: `npm run check:buttons` → sale con código 1 y lista, como mínimo:
      `meeting-hosts.component.html:85`, `meet-calendar.page.html:16`, `:111`, `:114` por
      contenido vacío, y los mismos por `label=`/`icon=` inertes. Guardar esa salida como prueba
      *red* en el reporte final del paso. Comprobar que **no** reporta
      `contract-form.page.html:505`, `inbox-shell.page.html:114` ni los demás botones con hijo
      visible (falsos positivos).

### Fase B — Hub: punto 1, botones vacíos

- [ ] 2. Revertir los cuatro botones de directiva a `<p-button>`.
      `meeting-hosts.component.html:85` → `<p-button type="submit" label="Guardar"
      icon="pi pi-check" [loading]="saving()" [disabled]="saving()" />` (igualar la forma del
      "Cancelar" vecino de la línea 84, que ya es `<p-button>`).
      `meet-calendar.page.html:16` → "Refrescar" (`icon="pi pi-refresh"`, `[outlined]="true"`,
      `severity="secondary"`, `[loading]="loading()"`, `(onClick)="refresh()"`).
      `meet-calendar.page.html:111` → "Eliminar" (`severity="danger"`, `[outlined]="true"`,
      `[loading]="saving()"`, `(onClick)="remove()"`).
      `meet-calendar.page.html:114` → "Guardar" (`type="submit"`, `icon="pi pi-check"`,
      `[loading]="saving()"`, `[disabled]="saving()"`).
      Ojo: el componente usa el output `(onClick)`, no `(click)`; el `type="submit"` dentro del
      `<form>` debe conservarse para que el envío siga funcionando. Verificar que ambos
      componentes importan `Button` de `primeng/button` (ya lo hacen por usar `<p-button>` en
      otras líneas; confirmar en el `imports` del `@Component`).
      Files: `src/app/indomito-hub/administration/configuration/components/meeting-hosts/meeting-hosts.component.html`,
      `src/app/indomito-hub/meet/meet-calendar.page.html`
      Verify: `npm run check:buttons` → `Button policy: OK` (prueba *green*). `npm run build`
      compila sin errores.

### Fase C — Hub: punto 3, acotar la regla global del spinner + test

- [ ] 3. Acotar las dos reglas globales de `src/styles.css` al caso de la directiva.
      En el bloque `@layer components`, cambiar
      `button.p-button-loading::before` → `button.p-button-loading:not([data-p])::before`
      y `button.p-button-loading.p-button-icon-only > *` →
      `button.p-button-loading:not([data-p]).p-button-icon-only > *`.
      Actualizar el comentario que las precede explicando el discriminador: el `<button>`
      interno del componente `<p-button>` siempre lleva `data-p`, la directiva nunca.
      No tocar la keyframe `indomito-button-spin`.
      Files: `src/styles.css`
      Verify: `npm run build` compila; inspeccionar el CSS emitido en `dist/` y confirmar que la
      regla publicada contiene `:not([data-p])`.

- [ ] 4. Agregar el test del contrato de un solo spinner.
      Nuevo spec con dos componentes de prueba standalone (uno con `<p-button [loading]="true">`,
      otro con `<button pButton [loading]="true">Guardar</button>`), montados con
      `TestBed.createComponent`. Afirmar:
      (a) el componente renderiza **exactamente un** indicador propio
      (`querySelectorAll('svg[data-p-icon="spinner"], .p-button-loading-icon').length === 1`) y su
      `<button>` **tiene** atributo `data-p` que incluye `loading` → la regla global queda
      excluida por `:not([data-p])`, luego el total es 1;
      (b) la directiva renderiza **cero** indicadores en el DOM y su `<button>` **no tiene**
      `data-p` → la regla global aplica y aporta el único indicador;
      (c) ambos botones llevan la clase `p-button-loading`.
      Además una aserción estática sobre el CSS: leer `src/styles.css` con `node:fs` y afirmar
      que las dos reglas de `p-button-loading` contienen `:not([data-p])` (protege el
      discriminador de futuras regresiones; jsdom no evalúa el `::before`).
      Documentar en comentarios TSDoc en español por qué se mide así y no contando píxeles.
      Files: `src/app/shared/ui/button-loading.spec.ts` (nuevo)
      Verify: `npm test` → el nuevo spec pasa y los 441 tests existentes siguen pasando.

### Fase D — Hub: punto 2, contraste en modo oscuro

- [ ] 5. Agregar las siete variables de `contrast` al bloque `.dark` de `src/styles.css`,
      inmediatamente después de las cuatro de `outlined-secondary` (líneas 97-100), con un
      comentario breve que explique que Aura resuelve `contrast` a `{surface.0}` en oscuro y que
      eso colisiona con el fondo del panel. Valores exactos en la decisión del punto 2.
      No agregar nada fuera de `.dark`. No tocar `indomito.preset.ts`.
      Files: `src/styles.css`
      Verify: `npm run build`; en el CSS emitido, confirmar que las siete variables aparecen
      **solo** dentro del selector `.dark`. Revisión visual en claro y oscuro de
      `contract-list`, `contract-form` y el diálogo de vista previa: etiqueta y borde legibles en
      reposo, hover, active y foco.

### Fase E — Hub: punto 4, revertir el ruido de renditions

- [ ] 6. Quitar `[loading]="busy()"` de los cuatro botones de `renditions.page.html`
      (líneas 74, 95, 114, 157), dejando solo `[disabled]="busy()"` como estaban antes de
      `26b8328`. **No** tocar la línea 41 (`[loading]` preexistente en el submit).
      Files: `src/app/indomito-hub/collections/pages/renditions/renditions.page.html`
      Verify: `npm run check:buttons` → OK (la regla que lo exigía ya se eliminó en el paso 1);
      `npm run build` y `npm test` pasan.

### Fase F — Hub: punto 7, menores

- [ ] 7. Igualar la jerarquía del tercer botón en la tarjeta móvil de contract-list.
      `contract-list.page.html:82-84`: el `<a pButton [routerLink]…>` ("Ver detalle"/"Editar")
      queda sin `severity`/`outlined` junto a dos `contrast outlined`. Agregarle
      `severity="contrast"` y `outlined` para que coincida con sus vecinos y con la fila de
      escritorio (líneas 163 y 172). No agregar `size="small"`: la tarjeta móvil usa el tamaño
      por defecto en los tres.
      Files: `src/app/indomito-hub/contracts/pages/contract-list/contract-list.page.html`
      Verify: `npm run build`; revisión a 320 px y 390 px en claro y oscuro: los tres botones
      apilados con el mismo alto, borde y tipografía.

- [ ] 8. Marcar los iconos hijos con la directiva `pButtonIcon`.
      Agregar el atributo `pButtonIcon` a los `<span>` de icono dentro de botones de directiva en:
      `contract-list.page.html:157` (`pi pi-file-pdf`), `contract-form.page.html:164`
      (`pi pi-file-pdf`), `document-preview-dialog.component.html:23` (`pi pi-times`), `:77`
      (`pi pi-download`) y `:89` (`[class]="options.primaryAction.icon"`).
      Importar `ButtonIcon` de `primeng/button` en el `imports` de cada componente que lo
      requiera (`contract-list.page.ts`, `contract-form.page.ts`,
      `document-preview-dialog.component.ts`); sin el import la directiva no se aplica y Angular
      no avisa. Nota: `pButtonIcon` está `@deprecated` pero es el único mecanismo soportado para
      iconos hijos de la directiva; esto no contradice la decisión del punto 1, que elimina el
      uso de la directiva solo donde no había contenido alguno.
      Files: los tres `.html` citados y sus tres `.ts`
      Verify: `npm run build` sin errores de plantilla; `npm test`; revisión visual del
      espaciado icono-texto en los botones tocados (debe aparecer la clase `p-button-icon`).

- [ ] 9. Unificar la presencia de icono en los "Ver PDF" equivalentes.
      Hoy `contract-list.page.html:157` lleva `pi pi-file-pdf` y los equivalentes no:
      `contract-form.page.html:239` (tarjeta móvil del historial) y `:278` (celda de la tabla), y
      la tarjeta móvil de `contract-list.page.html:67-74`. Agregar a esos tres el mismo
      `<span pButtonIcon class="pi pi-file-pdf" aria-hidden="true"></span>` antes del texto.
      Files: `src/app/indomito-hub/contracts/pages/contract-list/contract-list.page.html`,
      `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html`
      Verify: `npm run build`; a 320 px el botón con icono no desborda su contenedor (la tarjeta
      móvil de contract-form usa `w-full`).

- [ ] 10. Quitar `uppercase` del input de color en `meeting-hosts.component.html:67`
      (dejar `class="w-32"`). Ver decisión del punto 7d; no agregar estilo sustituto.
      Files: `src/app/indomito-hub/administration/configuration/components/meeting-hosts/meeting-hosts.component.html`
      Verify: `npm test` (los specs de configuración siguen pasando); revisión manual: guardar un
      anfitrión con color escrito en minúscula y confirmar que se persiste en mayúscula.

### Fase G — Pay: punto 6, portar la regla acotada del spinner

- [ ] 11. Agregar la regla del spinner, ya acotada, a
      `ind-pay-app-ngx-pri-gh/src/styles.css`.
      Insertar en el primer `@layer components` (el que contiene `.app-panel`, tras la línea
      ~120) las dos reglas `button.p-button-loading:not([data-p])::before` y
      `button.p-button-loading:not([data-p]).p-button-icon-only > *`, más la keyframe
      `indomito-button-spin`, con el mismo comentario explicativo del Hub. Usar `currentColor`
      y las unidades del Hub; **no** introducir colores literales ni tokens que ese repo no
      tenga (se verificó que comparte `@theme`, bloque `.dark` y los mismos nombres de token).
      Este repo no tiene hoy ningún `<p-button>` componente — el `:not([data-p])` se incluye de
      todas formas para que el contrato sea idéntico en los dos repos.
      Cubre los 12 `[loading]` sobre directiva existentes
      (`receipt-verification.page.html:27`, `lookup.page.html:82,95,193,314,331,343`,
      `khipu-dev.page.html:47,69,80,100,127`).
      Files: `ind-pay-app-ngx-pri-gh/src/styles.css`
      Verify: en ese repo, `npm run build` y `npm test` pasan; en el CSS emitido aparecen las dos
      reglas y la keyframe. Revisión visual: al pulsar "Ver cuotas" en `lookup` aparece
      exactamente un spinner.

### Fase H — Verificación final

- [ ] 12. Verificación completa en los dos repos.
      Hub: `npm run check:buttons` (OK), `npm run build` (sin errores), `npm test` (todos los
      specs, incluido el nuevo). Pay: `npm run build`, `npm test`.
      Registrar en el reporte: la salida *red* del paso 1, la *green* del paso 2, la tabla de
      ratios del punto 2 y la lista exacta de archivos modificados por repo
      (`git status --short` en cada uno).
      Verify: los cinco comandos terminan en éxito.

- [ ] 13. **No hacer commit ni push.** El usuario pidió explícitamente revisar los archivos
      tocados antes de cualquier commit ("no hagas commit ya que quiero ver los archivos que
      tocaste"). Dejar los cambios en el working tree de `main` en ambos repos, sin `git add`.
      Verify: `git status --short` en cada repo lista solo los archivos previstos y
      `git log -1 --oneline` sigue apuntando al commit previo a esta tanda.

---

## Fuera de alcance (no tocar)

- Backend Go `ind-hub-api-gox-sls-pri-gh`: el punto 1 del pedido original está cumplido y
  verificado.
- Generalizar `panelStyleClass` a los demás overlays del repo, o resolverlo en el preset.
- Cualquier refactor de `renditions`, `inbox`, `iam-admin` o `app-shell` más allá de lo listado.
- Selectores CSS globales nuevos sobre elementos de formulario; sobrescritura de tokens del
  preset fuera del bloque `.dark`.

## Riesgos y supuestos

- `data-p` del componente: si en una futura versión de PrimeNG el `<button>` interno deja de
  emitir `data-p`, la regla global volvería a aplicarse al componente y reaparecería el doble
  spinner. El paso 4 incluye la aserción que lo detectaría.
- Verificación visual: no hay automatización de navegador en el entorno (no hay playwright ni
  puppeteer en `node_modules`). Los ítems marcados como "revisión visual" deben ejecutarse a
  mano o reportarse como no verificados; los de contraste sí son concluyentes por cálculo.
- Paso 8: si al importar `ButtonIcon` algún spec existente de esos componentes falla por el
  cambio de clases en el DOM, ajustar el spec, no revertir la directiva.
