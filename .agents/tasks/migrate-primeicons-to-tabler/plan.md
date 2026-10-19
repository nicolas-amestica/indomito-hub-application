# Plan de implementación — Migrar PrimeIcons (`pi`) a Iconify/Tabler + dejar la regla como steering

Fecha: 2026-10-19
Repos involucrados: `app-ngx-hub` (entregable A), `app-ngx-pay` (verificado: nada que migrar),
`ind-hub-orc` (entregable B).

---

## 0. Reglas de ejecución (no negociables)

- **Sin commits, sin push, sin worktrees** en ningún repo. Trabajar en el checkout principal, rama `main`.
- `app-ngx-hub` **ya tiene cambios previos aprobados** en el working tree (staged y unstaged). **No**
  `git reset`, **no** `git checkout`/`restore` de archivos, **no** `git stash`, **no** revertir nada.
  Construir encima.
- `app-ngx-pay` tiene `src/styles.css` modificado sin commitear: **no tocarlo ni revertirlo**.
- `ind-hub-orc` tiene el working tree limpio y el sync **al día** (verificado con
  `sync-context.sh --check`: todo `UNCHANGED`). Si al momento de implementar ya no estuviera limpio
  o apareciera drift ajeno, **detenerse y preguntar**.
- Ante cualquier inconsistencia: **preguntar al usuario**, no limpiar.

---

## 1. Hallazgos de la exploración (base de todas las decisiones)

### 1.1 Sistema de iconos real por repo (verificado en `package.json` y en el CSS compilado)

| Repo | `primeicons` | Iconify/Tabler | Conclusión |
| --- | --- | --- | --- |
| `app-ngx-hub` | **no instalado**, no importado, **0** reglas `.pi-*` en `dist/*/browser/styles-*.css` | `@iconify-json/tabler@^1.2.40` + `@iconify/tailwind4@^1.2.3`, `@plugin '@iconify/tailwind4'` en `src/styles.css:2` | Todo `pi` es **inerte**. Migrar. |
| `app-ngx-pay` | **no instalado**, **0** reglas `.pi-*` | mismas dos dependencias, mismo `@plugin` en `src/styles.css:2` | **Cero ocurrencias `pi`** en `src/`. Nada que migrar. |
| `app-ngx-web` | **`primeicons@^7.0.0` instalado** e importado en `src/styles.css:5` (`@import 'primeicons/primeicons.css'`) | no usa Iconify | **PrimeIcons es legítimo aquí** (19 ocurrencias activas). No migrar y **no prohibir globalmente**. |

> Consecuencia de diseño para el entregable B: la prohibición de `pi` **no puede ser global**. Si se
> escribe como regla universal, contradice un repo en producción que lo usa correctamente. La regla
> debe quedar **acotada a `app-ngx-hub` y `app-ngx-pay`** (ver sección 7).

### 1.2 Forma real de las clases Iconify en el CSS emitido

```
.icon-\[tabler--lock\]{display:inline-block;width:1em;height:1em;background-color:currentColor;
 -webkit-mask-image:var(--svg);mask-image:var(--svg);...}
```

- Es `inline-block`, de `1em`, y **hereda el color** por `currentColor`. Sirve dentro de botones y
  también en texto corrido.
- Tailwind **sí escanea archivos `.ts`**: `icon-[tabler--layout-dashboard]`, que solo existe en
  `src/app/core/layout/app-shell.component.ts:15`, aparece en el CSS compilado. Por lo tanto una
  constante de icono en un `.ts` no necesita safelist.
- `src/styles.css:6` tiene un `@source inline(...)` con los iconos que llegan **desde DynamoDB** y no
  son descubribles en plantillas. Solo hay que agregar ahí nombres cuyo origen sea dato de BD.

### 1.3 Patrón establecido en el repo (referencia: `inbox-shell.page.html` + los 11 iconos ya migrados)

- **Botón icon-only**: `<button pButton ... iconOnly aria-label="…">` con el icono como **hijo
  desnudo**: `<span class="icon-[tabler--x] size-5" aria-hidden="true"></span>`.
- **Botón con etiqueta (directiva `pButton`)**: icono como hijo desnudo + el texto. Nunca atributos
  `icon`/`label` sobre la directiva (R4 del verificador los rechaza) y nunca `pButtonIcon` junto a
  texto visible (R6: la directiva infiere icon-only y **colapsa el ancho** — causa de los “botones
  muy angostos” ya reportados).
- **Componente `<p-button>`**: sí admite el input `icon`, y el repo ya le pasa clases Iconify:
  `icon="icon-[tabler--plus] size-4"` (`meet-calendar.page.html:5`, `meeting-hosts.component.html:9`).
- **`<p-fileupload mode="basic">`**: `chooseIcon` se renderiza como `<span [class]="chooseIcon()">`
  **sin prefijos** (verificado en `node_modules/primeng/fesm2022/primeng-fileupload.mjs`), por lo que
  una clase Iconify funciona tal cual. Ya se usa así en `inbox-shell.page.html:110`
  (`chooseIcon="icon-[tabler--paperclip]"`).
  **Advertencia**: en `mode` avanzado PrimeNG compone `cn('p-button-icon p-button-icon-left pi', chooseIcon())`
  y mete un `pi` propio imposible de evitar. Los tres `p-fileupload` de esta tarea son `mode="basic"`,
  así que no aplica; si alguna vez se pasa a modo avanzado, hay que usar el template `#chooseicon`.
- **Acción dinámica del visor de documentos**: `document-preview-dialog.component.html:84` hace
  `<span [class]="options.primaryAction.icon">`, es decir el valor de `DocumentPreviewAction.icon`
  (`src/app/shared/documents/interfaces/document-preview.interface.ts:12`) se usa **como clase**.
  Basta cambiar el string en el origen.

### 1.4 Spinners (punto A3) — nada que migrar

- `grep` de `pi-spin` y `pi-spinner` en todo `src/`: **0 resultados**.
- La regla global del spinner vive en `src/styles.css` acotada con `:not([data-p])` y está protegida
  por **R5** de `tools/check-button-policy.mjs`, más los specs `src/app/shared/ui/button-loading.spec.ts`.
- **Acción: ninguna.** No tocar `styles.css` ni esos specs. El invariante “un solo spinner por botón”
  ya está cubierto y esta migración no lo altera (ninguna ocurrencia a migrar es un indicador de carga).

### 1.5 `resolveIamModuleIcon()` — **no es código muerto, no se borra**

`src/app/indomito-hub/administration/iam/fn/fn-iam-module-view.ts:22` descarta iconos que empiezan
con `pi `. Ese valor **no viene del código fuente: viene de DynamoDB** (`IamModule.icon`). Es una
defensa de datos, no un resto de migración.

- **Decisión: conservar la función intacta** y conservar los casos
  `fn-iam-module-view.spec.ts:38-40` con sus strings `pi pi-*`, porque son el **dato de entrada** que
  prueba esa defensa. Esto corrige el supuesto del brief (“limpiar el tratamiento legacy de `pi`”):
  limpiarlo sería una regresión funcional.

---

## 2. Inventario completo de PrimeIcons

Barrido propio sobre `src/` y `tools/` de ambos frontends con los patrones: `pi pi-`, `icon="pi`,
`[icon]=` con literal `pi`, `pi-spin`, `pi-spinner`, `class="pi"`, y cualquier string `pi-*` en `.ts`
(constantes, mapas de menú, columnas, acciones). Patrón final usado, sin falsos positivos:
`/(?<![\w-])pi(?: pi)?-[a-z0-9-]*/g`.

### 2.1 `app-ngx-hub` — código de producción: **5 ocurrencias**

| # | Archivo:línea | Clasificación | Ocurrencia | Contexto |
| --- | --- | --- | --- | --- |
| 1 | `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html:72` | icono en input de componente | `chooseIcon="pi pi-upload"` | `<p-fileupload mode="basic">` “Cargar Excel” |
| 2 | `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html:112` | icono decorativo fuera de botón | `<span class="pi pi-lock mr-2" aria-hidden="true">` | banner esmeralda de contrato bloqueado |
| 3 | `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html:200` | icono en input de componente | `chooseIcon="pi pi-upload"` | `<p-fileupload mode="basic">` “Cargar contrato firmado” |
| 4 | `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.ts:622` | icono en datos/constante | `icon: 'pi pi-check-circle'` | `primaryAction` “Aprobar contrato” del visor de PDF |
| 5 | `src/app/indomito-hub/collections/pages/tax-documents/tax-documents.page.html:167` | icono en input de componente | `chooseIcon="pi pi-upload"` | `<p-fileupload mode="basic">` “Seleccionar PDF” |

**Botones con etiqueta: 0. Botones icon-only: 0.** Las ocurrencias de botones que listaba la sección 18
del antecedente (`meet-calendar` 5/16/114, `meeting-hosts` 9/85, `contract-list` 75/162,
`contract-form` 164/239/279, `document-preview-dialog` 77) **ya fueron migradas en la tanda previa** y
hoy usan `icon-[tabler--*]`. Verificado uno a uno. El inventario pendiente real es el de arriba.

### 2.2 `app-ngx-hub` — ocurrencias que **se conservan a propósito**: 2 archivos

| Archivo:línea | Ocurrencia | Por qué se conserva |
| --- | --- | --- |
| `.../iam/fn/fn-iam-module-view.spec.ts:38,39,40` | `'pi pi-wallet'`, `'pi pi-chart-line'`, `'pi pi-play-circle'` | Dato de entrada que prueba la defensa de `resolveIamModuleIcon()` contra iconos `pi` almacenados en DynamoDB (ver 1.5) |
| `.../document-preview-dialog.component.spec.ts:85,88` | comentario `` `pi pi-*` `` + aserción `not.toContain('pi-times')` | Prosa explicativa y aserción negativa que **garantiza** que no se reintroduzca `pi` |

### 2.3 `app-ngx-hub` — menciones en herramientas (no son uso de iconos)

`tools/check-button-policy.mjs:27,57,186,256` — la propia regla R7 y su línea base. Se **modifican**
en el paso 6, no se eliminan.

### 2.4 `app-ngx-pay` — **0 ocurrencias**

Barrido sobre `src/` con los mismos patrones: sin resultados. Único uso de iconos:
`src/app/core/theme/theme.service.ts:11` ya en Tabler. **Nada que migrar en Pay.** Pay solo recibe la
regla documental del entregable B.

---

## 3. Tabla de equivalencias `pi-*` → `icon-[tabler--*]` (nombres verificados)

Verificación hecha contra el set realmente instalado (`node_modules/@iconify-json/tabler/icons.json`,
6462 nombres incluyendo alias). Resultado por nombre:

| `pi-*` original | Tabler propuesto | ¿Existe en el set? | Nota |
| --- | --- | --- | --- |
| `pi-upload` | `upload` | **sí** | Equivalente directo (flecha hacia arriba sobre bandeja) |
| `pi-lock` | `lock` | **sí** | Equivalente directo. Ya está en el `@source inline` y ya se emite en el CSS actual |
| `pi-check-circle` | `circle-check` | **sí** | `check-circle` **NO existe** en Tabler; el orden correcto es `circle-check`. Mismo tipo de error que `file-pdf` → `file-type-pdf` |

Contraste comprobado del naming (lección del antecedente, re-verificada):
`file-pdf` → **MISS**, `file-type-pdf` → **OK**; `check-circle` → **MISS**, `circle-check` → **OK**.

**Casos sin equivalente exacto: ninguno.** Las tres equivalencias son directas y semánticamente
idénticas. No hay nada que marcar para revisión del usuario en esta tabla.

Alternativas descartadas y por qué: `cloud-upload` y `file-upload` existen pero cambian el significado
(subida a la nube / subir archivo concreto) frente al genérico `upload` que replica `pi-upload`;
`circle-check-filled` existe pero es relleno y rompería la coherencia con el resto de iconos del
proyecto, que son de trazo.

---

## 4. Impacto visual esperado (declararlo, no esconderlo)

Las cinco migraciones **hacen aparecer iconos donde hoy no se ve ninguno**. Es exactamente lo que el
usuario pidió, pero conviene tenerlo escrito para la revisión:

- Tres botones de carga de archivo pasan de solo texto a icono + texto.
- El banner de contrato bloqueado gana un candado antes del texto.
- El botón “Aprobar contrato” del visor gana un check circular.

Ninguno cambia de tamaño de forma brusca: `p-fileupload` ya reserva el `gap` del botón y el banner usa
`mr-2`, ya presente.

---

## 5. Plan de implementación — Entregable A (`app-ngx-hub`)

- [ ] **1. Migrar los tres `chooseIcon` de `p-fileupload`.**
      Reemplazar `chooseIcon="pi pi-upload"` por `chooseIcon="icon-[tabler--upload] size-4"` en las
      tres ocurrencias. `size-4` iguala el tamaño que ya usan los demás iconos de botón del repo
      (`icon-[tabler--plus] size-4`, `icon-[tabler--check] size-4`). No tocar ningún otro atributo de
      los `p-fileupload`, ni `mode`, ni `chooseLabel`.
      Files: `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html` (líneas 72 y 200),
      `src/app/indomito-hub/collections/pages/tax-documents/tax-documents.page.html` (línea 167)
      Verify: `npm run check:buttons` → sigue en OK salvo la violación esperada de la línea base R7,
      que se resuelve en el paso 6 (ver nota de orden abajo).

- [ ] **2. Migrar el candado decorativo del banner de contrato bloqueado.**
      `<span class="pi pi-lock mr-2" aria-hidden="true"></span>` →
      `<span class="icon-[tabler--lock] mr-2 size-4 align-text-bottom" aria-hidden="true"></span>`.
      Mantener `aria-hidden="true"`: es decorativo y el texto del banner ya comunica el estado.
      `align-text-bottom` alinea el `inline-block` de 1em con la línea de texto de 14 px; si en la
      revisión visual queda alto o bajo, ajustar a `align-[-0.1875em]` (Tailwind 4 admite el valor
      arbitrario) **antes** de considerar convertir el banner en `flex`, que sería un cambio de layout
      mayor que lo pedido.
      Files: `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.html` (línea 112)
      Verify: `npm run build` y comprobar en el CSS emitido que `icon-\[tabler--lock\]` sigue presente.

- [ ] **3. Migrar el icono de la acción primaria del visor de documentos.**
      En `contract-form.page.ts:622`, `icon: 'pi pi-check-circle'` → `icon: 'icon-[tabler--circle-check] size-4'`.
      El valor se inyecta como clase en `document-preview-dialog.component.html:84`
      (`<span [class]="options.primaryAction.icon">`), así que el string es la clase completa.
      Como el string vive en un `.ts` y Tailwind escanea `.ts` (ver 1.2), **no** hace falta agregarlo
      al `@source inline` de `styles.css`. Hay que **comprobarlo** en el CSS emitido, no asumirlo: si
      por alguna razón no apareciera, agregar `icon-[tabler--circle-check]` al `@source inline` y
      dejar constancia.
      Files: `src/app/indomito-hub/contracts/pages/contract-form/contract-form.page.ts` (línea 622)
      Verify: `npm run build`, luego
      `grep -c 'icon-\\\[tabler--circle-check\\\]' dist/ind-hub-app-ngx-pri-gh/browser/styles-*.css`
      → debe devolver ≥ 1.

- [ ] **4. Comprobar que los cuatro iconos nuevos se emiten de verdad en el CSS.**
      No basta con que la clase esté escrita en la plantilla: la regla CSS tiene que existir, que es
      precisamente el fallo que originó toda esta tarea.
      Files: ninguno (verificación)
      Verify: `npm run build` y luego, sobre
      `dist/ind-hub-app-ngx-pri-gh/browser/styles-*.css`, confirmar **≥ 1** coincidencia de cada uno:
      `icon-\[tabler--upload\]`, `icon-\[tabler--lock\]`, `icon-\[tabler--circle-check\]`, y
      **0** coincidencias de `primeicons` y de `\.pi-`.

- [ ] **5. Revisión visual en las tres pantallas afectadas, claro y oscuro, 320/390/tablet/escritorio.**
      Pantallas: formulario de contrato (banner bloqueado, “Cargar Excel”, “Cargar contrato firmado”),
      documentos tributarios (“Seleccionar PDF”), visor de PDF con contrato en `PENDING_APPROVAL`
      (“Aprobar contrato”). Confirmar: el icono se ve, hereda el color del texto del botón en ambas
      variantes, no desborda, no estrecha el botón, y los `p-fileupload` conservan su etiqueta.
      Files: ninguno (verificación manual)
      Verify: inspección en navegador según el procedimiento de
      `docs/standards/frontend/design-system-usage.md` § “Verificación de cambios visuales”.

- [ ] **6. Endurecer R7 en `tools/check-button-policy.mjs` y ajustar su línea base.**
      R7 ya existe (`\bpi pi-[a-z0-9-]*`). Dos cambios:
      a) **Ampliar el patrón** a `/(?<![\w-])pi(?: pi)?-[a-z0-9-]*/g`, que además de `pi pi-x` detecta
         un `pi-x` suelto (hoy invisible para la regla). Verificado sobre todo `src/app`: **cero
         falsos positivos** (no matchea `api-`, `icon-[tabler--…]`, etc.).
      b) **Reducir la línea base** `LEGACY_PI_ICONS` a solo los dos archivos que conservan `pi` a
         propósito, con los recuentos medidos con el patrón nuevo:
         `fn-iam-module-view.spec.ts` → **3**;
         `document-preview-dialog.component.spec.ts` → **2** (el comentario de la línea 85 y
         `pi-times` de la 88). Eliminar las entradas de `contract-form.page.html`,
         `contract-form.page.ts` y `tax-documents.page.html`.
         Actualizar los comentarios de la constante y el bloque de prosa de R7 (líneas 27 y 57) para
         que describan el estado real: la deuda de producción quedó en cero y lo que resta es solo
         material de prueba.
      El guardia “la línea base solo puede encoger” que ya existe al final del archivo garantiza que
      el inventario no vuelva a crecer sin que nadie lo note.
      Files: `tools/check-button-policy.mjs`
      Verify (**red/green demostrable**):
      - **Green**: `npm run check:buttons` → `Button policy: OK`.
      - **Red**: agregar temporalmente `icon="pi pi-upload"` en cualquier plantilla de `src/app`,
        correr `npm run check:buttons` → debe fallar citando R7 con archivo:línea; **revertir esa
        línea introducida a mano** (edición puntual del archivo, nunca `git checkout`).
      - **Red del patrón nuevo**: repetir la prueba con un `pi-trash` suelto (sin el prefijo `pi `)
        → también debe fallar. Revertir igual.

- [ ] **7. Suite completa de verificación del repo.**
      Files: ninguno
      Verify, en este orden:
      `npm run check:buttons` → OK;
      `npm test` (builder `@angular/build:unit-test`, Vitest; si queda en modo watch, `npm test -- --no-watch`)
      → **toda** la suite pasa, en particular `src/app/shared/ui/button-loading.spec.ts`,
      `src/app/shared/documents/components/document-preview-dialog/document-preview-dialog.component.spec.ts`
      y `src/app/indomito-hub/administration/iam/fn/fn-iam-module-view.spec.ts`;
      `npm run build` → sin errores.

- [ ] **8. Barrido final de confirmación.**
      Files: ninguno
      Verify: `grep -rnE '(?<![\w-])pi(?: pi)?-[a-z]' src/` (o el equivalente con `grep -P`) devuelve
      **solo** las 5 ocurrencias de los dos archivos de prueba listados en 2.2. Nada más.

**Nota de orden**: los pasos 1–3 dejan el repo con R7 “violado por defecto a la baja” — es decir, los
archivos listados en `LEGACY_PI_ICONS` tendrán menos `pi` de los declarados, lo que dispara el guardia
de final de archivo. Eso es esperado y se resuelve en el paso 6. Entre el paso 1 y el paso 6 el
proyecto **compila y los tests pasan**; solo `check:buttons` reporta el desajuste de la línea base. Si
se prefiere no dejar ningún paso con `check:buttons` en rojo, hacer el paso 6b (bajar la línea base)
inmediatamente después del paso 3 y el 6a al final.

### Fuera de alcance, justificado

- **No** eliminar ni modificar `resolveIamModuleIcon()` ni sus specs (ver 1.5).
- **No** tocar `src/styles.css` (ni la regla del spinner ni el `@source inline`), salvo el caso de
  contingencia del paso 3.
- **No** migrar nada en `app-ngx-pay`: no hay ocurrencias.
- **No** tocar `app-ngx-web`: usa PrimeIcons legítimamente.

---

## 6. Entregable B — dónde vive la regla (investigación y decisión)

### 6.1 Mecánica real del orquestador (verificada en código)

- `ai/sync-config.json` declara 6 repos consumidores (`app-ngx-hub`, `app-ngx-pay`, `app-ngx-web`,
  `ind-hub-api`, `ind-hub-iam`, `ind-hub-inf`) y 4 agentes de salida (`claude`, `gemini`, `kiro`,
  `agents`).
- **Fuentes de verdad editables**: `ai/source/global-context/*.md` (`agent-charter.md`,
  `output-style.md`, `repo-routing.md`, `spec-lifecycle.md`) y `ai/source/repo-overrides/<alias>.md`.
- **Salidas auto-generadas, prohibido editar**: `ai/generated/**`, el `AGENTS.md`/`CLAUDE.md`/
  `GEMINI.md`/`.kiro/steering/*` de cada repo, y el propio `.kiro/steering/` del orquestador.
- `tools/scripts/sync-context.sh` es un envoltorio de `npx tsx tools/context/cli.ts`, que acepta
  `--repo`, `--validate`, `--validate-only`, `--dry-run`, `--check`, `--json`.
- `tools/scripts/build-agent-files.ts:605-607` marca `agent-charter.md` y `output-style.md` como
  `orchestrator-only`: su salida Kiro se escribe **solo** en `ind-hub-orc/.kiro/steering/` con
  `inclusion: auto` (para no triplicar tokens), y su **contenido completo** se embute además en el
  `AGENTS.md` de cada repo. Verificado: el `.kiro/steering/agent-charter.md` del orquestador lleva
  cabecera `AUTO-GENERATED` + `Source: ai/source/global-context/agent-charter.md`.
- `docs/standards/frontend/design-system-usage.md` y `ui-patterns.md` se exponen a los repos solo como
  **índice de rutas** en `.kiro/steering/standards-ref.md` (`inclusion: manual`): son referencia de
  consulta, **no** contexto activo.

**Conclusión**: el único camino para que la regla quede **ACTIVA como steering** (lo que pidió el
usuario literalmente) es `ai/source/global-context/agent-charter.md`, sección
“Arquitectura Frontend — Features Angular”. Es donde ya viven las reglas duras de UI
(`border-line/75`, pareja fondo/texto, mobile-first 320/390, prohibición de CSS artesanal).

### 6.2 Decisión de ubicación (y cómo evitar duplicación)

| Dónde | Qué va | Por qué |
| --- | --- | --- |
| `ai/source/global-context/agent-charter.md` § Arquitectura Frontend | **1 viñeta corta, operativa y acotada por repo**: cuál es el sistema de iconos de cada frontend, la prohibición de `pi` en Hub/Pay, y el deber de verificar el nombre y el render | Es el único origen que termina como steering `inclusion: auto` y dentro de todos los `AGENTS.md`. Estilo y densidad idénticos a las viñetas vecinas |
| `docs/standards/frontend/design-system-usage.md` | **El detalle operativo**: paquetes, forma de la clase, el síntoma, los casos de nombre (`file-pdf`→`file-type-pdf`, `check-circle`→`circle-check`), accesibilidad del icono, el caso `p-fileupload` avanzado, el verificador R7 como mecanismo de cumplimiento | Es el hogar natural de la guía del sistema de diseño; la viñeta del charter apunta aquí en vez de repetirlo |
| `ai/source/repo-overrides/app-ngx-hub.md` y `app-ngx-pay.md` | **1 línea cada uno**: “iconos Iconify/Tabler; PrimeIcons prohibido” | Reglas por repo; `app-ngx-pay` necesita la regla aunque hoy esté limpio, para no introducirla nunca |
| `ai/source/repo-overrides/app-ngx-web.md` | **1 línea**: PrimeIcons es el sistema de este repo; no introducir Iconify sin decisión explícita | Impide que un agente “corrija” un repo que está bien |
| `ui-patterns.md` | **nada** | Evitar duplicación; el charter ya prohíbe duplicar reglas entre estándares y steering |

### 6.3 Contenido de la regla

**Viñeta para `agent-charter.md` § Arquitectura Frontend** (español con tildes, imperativa, al nivel
de las viñetas vecinas):

> El sistema de iconos de cada frontend es el que declara su `package.json`, y no se mezcla con otro.
> En `app-ngx-hub` y `app-ngx-pay` es Iconify/Tabler, con clases `icon-[tabler--nombre]`: PrimeIcons
> está **prohibido** en esos repos porque el paquete no está instalado, el CSS compilado no contiene
> ninguna regla `.pi-*` y toda clase `pi pi-*` es inerte — el síntoma típico es un botón icon-only
> completamente en blanco. No usar `pi` ni en plantillas, ni en el input `icon` de un componente, ni
> en constantes, mapas de menú o datos. `app-ngx-web` usa PrimeIcons y lo conserva. Al agregar un
> icono, verificar que el nombre existe de verdad en el set instalado (`file-pdf` no existe: el
> correcto es `file-type-pdf`; `check-circle` tampoco: es `circle-check`) y comprobar en el CSS
> emitido que la clase se generó, no solo que está escrita en la plantilla. Los botones icon-only
> requieren `ariaLabel`/`aria-label` y los iconos decorativos dentro de un botón con etiqueta van con
> `aria-hidden="true"`; no usar `pButtonIcon` sin un `pButtonLabel` hermano, porque la directiva
> infiere icon-only y colapsa el ancho del botón. Detalle operativo en
> `docs/standards/frontend/design-system-usage.md`.

**Sección nueva para `design-system-usage.md`** (encabezado `## Sistema de iconos`, ubicada después de
`## Reglas de Uso`), con: los paquetes exactos (`@iconify-json/tabler`, `@iconify/tailwind4`, el
`@plugin` en `styles.css`); la forma `icon-[tabler--nombre]` más la clase de tamaño (`size-4` en
botones, `size-5` en icon-only); el patrón por tipo de uso (hijo desnudo con la directiva `pButton`,
input `icon` del componente `<p-button>`, `chooseIcon` de `p-fileupload` en `mode="basic"` y el
template `#chooseicon` en modo avanzado, donde PrimeNG inyecta un `pi` propio); la nota de que los
nombres de icono que llegan desde DynamoDB deben declararse en `@source inline(...)` porque Tailwind
no los descubre; la verificación obligatoria contra el CSS emitido; y la mención a
`npm run check:buttons` (regla R7) como mecanismo automático de cumplimiento en `app-ngx-hub`.
Actualizar `last-updated` a la fecha de la edición (el validador
`tools/standards/validate.ts` exige el formato `YYYY-MM-DD` y marca como abandonado lo que supere 180
días).

---

## 7. Plan de implementación — Entregable B (`ind-hub-orc`)

- [ ] **9. Editar la fuente del charter.**
      Agregar la viñeta de 6.3 al final de la sección “## Arquitectura Frontend — Features Angular”,
      justo antes de la viñeta de autocontención de features, para que quede junto a las reglas de UI
      y no entre las de estructura de carpetas. **No editar** ningún archivo con cabecera
      `AUTO-GENERATED`.
      Files: `ai/source/global-context/agent-charter.md`
      Verify: `grep -c 'icon-\[tabler--nombre\]' ai/source/global-context/agent-charter.md` → 1; y
      `grep -rn 'AUTO-GENERATED' ai/source/global-context/agent-charter.md` → sin resultados
      (confirma que se editó una fuente y no una salida).

- [ ] **10. Editar el estándar de frontend.**
      Agregar la sección `## Sistema de iconos` descrita en 6.3 y actualizar `last-updated` en el
      front-matter. Sin duplicar el texto del charter: el estándar desarrolla, el charter ordena.
      Files: `docs/standards/frontend/design-system-usage.md`
      Verify: `bash tools/scripts/sync-context.sh --validate-only` → el validador de estándares pasa
      (comprueba front-matter, fechas y referencias).

- [ ] **11. Editar los tres repo-overrides.**
      Una línea en la sección `## Reglas` de cada uno, según la tabla de 6.2.
      Files: `ai/source/repo-overrides/app-ngx-hub.md`, `ai/source/repo-overrides/app-ngx-pay.md`,
      `ai/source/repo-overrides/app-ngx-web.md`
      Verify: `grep -n -i 'icono' ai/source/repo-overrides/app-ngx-{hub,pay,web}.md` → una línea por
      archivo.

- [ ] **12. Simular la propagación y revisar el alcance ANTES de aplicarla.**
      Files: ninguno
      Verify: `bash tools/scripts/sync-context.sh --dry-run` y revisar la lista de archivos marcados
      como cambiados. **Lo esperado** (porque el charter se embute en los artefactos globales de cada
      repo) es: `ind-hub-orc/.kiro/steering/agent-charter.md`, más por cada uno de los 6 repos
      `AGENTS.md`, `.claude/CLAUDE.md`, `.gemini/GEMINI.md` y `.claude/rules/global-rules.md`, más
      `.claude/rules/repo-rules.md` solo en los tres frontends con repo-override editado, más
      `ai/generated/**` equivalente.
      **Criterio de parada**: si aparece **cualquier** archivo fuera de ese conjunto —algo derivado de
      `output-style`, `repo-routing`, `spec-lifecycle`, MCP, skills o un repo sin cambios de
      override— **detenerse y preguntar al usuario** antes de aplicar. Línea base ya establecida: hoy
      `--check` reporta **todo `UNCHANGED`**, así que cualquier diferencia extra sería trabajo ajeno a
      esta tarea.

- [ ] **13. Aplicar la propagación.**
      Files: ninguno (el script escribe las salidas auto-generadas)
      Verify: `bash tools/scripts/sync-context.sh --validate`, luego `bash tools/scripts/sync-context.sh --check`
      → vuelve a reportar todo `UNCHANGED` (idempotencia confirmada).
      **Advertencia de alcance**: este paso escribe en el working tree de **los 6 repos** del
      workspace, incluidos `ind-hub-api`, `ind-hub-iam`, `ind-hub-inf` y `app-ngx-web`, que no
      participan de la migración de iconos. Son archivos auto-generados y derivados del charter, de
      modo que es el comportamiento correcto del sistema, pero hay que **avisarlo explícitamente al
      usuario** al reportar, porque verá archivos modificados en repos que no pidió tocar. Si prefiere
      limitar el alcance, existe `--repo <alias>`, aunque dejaría los demás repos desincronizados y
      `--check` en rojo; esa es una decisión del usuario, no del implementador.

- [ ] **14. Verificar que la regla quedó ACTIVA como steering.**
      Files: ninguno
      Verify:
      - `grep -n 'inclusion: auto' ind-hub-orc/.kiro/steering/agent-charter.md` → presente.
      - `grep -c 'icon-\[tabler--nombre\]' ind-hub-orc/.kiro/steering/agent-charter.md` → ≥ 1.
      - `grep -l 'icon-\[tabler--nombre\]' <cada repo>/AGENTS.md` → aparece en los 6.
      - Confirmar que `ind-hub-app-ngx-pri-gh/AGENTS.md` y `ind-pay-app-ngx-pri-gh/AGENTS.md`
        contienen además su línea de repo-override.

- [ ] **15. Reporte final al usuario, sin commits.**
      Files: ninguno
      Verify: `git status --short` en los 8 repos del workspace; entregar la lista de archivos
      tocados, separando (a) migración de iconos en `app-ngx-hub`, (b) fuentes editadas en
      `ind-hub-orc`, (c) salidas auto-generadas regeneradas por el sync en los 6 repos. Confirmar que
      **no hay ningún commit nuevo** en ninguno (`git log --oneline -1` igual al de partida) y que los
      cambios previos aprobados de `app-ngx-hub` y el `src/styles.css` de `app-ngx-pay` siguen
      presentes e intactos.

---

## 8. Supuestos y puntos a confirmar con el usuario

1. **Alcance del sync** (paso 13): regenerar el charter toca los 6 repos. Supuesto: es aceptable
   porque son archivos auto-generados. Si el usuario prefiere `--repo app-ngx-hub --repo app-ngx-pay`,
   hay que asumir drift en los otros cuatro.
2. **Aparición de iconos nuevos** (sección 4): las cinco migraciones hacen visibles iconos que hoy no
   se ven. El usuario ya lo autorizó explícitamente (“Reemplaza los íconos pi por los de Tabler”), por
   lo que se ejecuta sin volver a preguntar; solo se destaca en el reporte final.
3. **`resolveIamModuleIcon()` no se limpia** (1.5), contra lo que sugería el brief: su guardia `pi`
   protege datos de DynamoDB, no código. Si el usuario quiere eliminarla igual, hay que migrar primero
   los valores almacenados en la tabla, que es trabajo de backend/datos fuera de esta tarea.
4. **`app-ngx-web` no se toca.** Usa PrimeIcons de forma legítima e instalada. Si el usuario quisiera
   unificarlo a Tabler, es una tarea aparte: 19 ocurrencias, otro repo, otra versión de PrimeNG (21) y
   un cambio de dependencias.
