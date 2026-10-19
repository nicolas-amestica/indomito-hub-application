# Notas de verificación — Migrar PrimeIcons (`pi`) a Iconify/Tabler

Fecha de ejecución: 2026-10-19
Repos tocados: `app-ngx-hub` (migración + verificador), `ind-hub-orc` (steering y estándar).
`app-ngx-pay` **no se tocó**: cero ocurrencias `pi`, por lo que no se ejecutaron su build ni sus tests.

Sin commits en ningún repositorio.

---

## 1. Inventario antes / después

Patrón usado: `/(?<![\w-])pi(?: pi)?-[a-z0-9-]*/g` (detecta `pi pi-x` y también un `pi-x` suelto).

Antes — 5 ocurrencias en código de producción:

| Archivo:línea | Ocurrencia |
| --- | --- |
| `contracts/.../contract-form.page.html:72` | `chooseIcon="pi pi-upload"` |
| `contracts/.../contract-form.page.html:112` | `<span class="pi pi-lock mr-2">` |
| `contracts/.../contract-form.page.html:200` | `chooseIcon="pi pi-upload"` |
| `contracts/.../contract-form.page.ts:622` | `icon: 'pi pi-check-circle'` |
| `collections/.../tax-documents.page.html:167` | `chooseIcon="pi pi-upload"` |

Después — **0 en producción**. Lo único que queda es material de prueba que necesita el string
`pi` para cumplir su función (línea base declarada en `LEGACY_PI_ICONS`):

```
$ grep -rnE '(^|[^[:alnum:]_-])pi( pi)?-[a-z0-9]' src/
src/app/indomito-hub/administration/iam/fn/fn-iam-module-view.spec.ts:38:    ['PAY', 'pi pi-wallet', 'icon-[tabler--wallet]'],
src/app/indomito-hub/administration/iam/fn/fn-iam-module-view.spec.ts:39:    ['PAYMENT_OPERATIONS', 'pi pi-chart-line', 'icon-[tabler--cash-register]'],
src/app/indomito-hub/administration/iam/fn/fn-iam-module-view.spec.ts:40:    ['PAYMENT_SETUP', 'pi pi-play-circle', 'icon-[tabler--rocket]'],
src/app/shared/documents/components/document-preview-dialog/document-preview-dialog.component.spec.ts:88:    expect(icon?.className).not.toContain('pi-times');

$ grep -rn 'icon="pi' src/
(sin resultados)
```

En `app-ngx-pay`, los dos greps anteriores no devuelven nada.

Las 3 ocurrencias de `fn-iam-module-view.spec.ts` son el **dato de entrada** que prueba la defensa de
`resolveIamModuleIcon()` contra iconos `pi` almacenados en DynamoDB; la de
`document-preview-dialog.component.spec.ts` es una **aserción negativa** que garantiza que no se
reintroduzca `pi`. Borrarlas sería una regresión de cobertura, no una limpieza.

## 2. Equivalencias aplicadas

| `pi-*` original | Tabler aplicado | Verificado contra el set instalado |
| --- | --- | --- |
| `pi-upload` | `icon-[tabler--upload] size-4` | OK |
| `pi-lock` | `icon-[tabler--lock] mr-2 size-4 align-text-bottom` | OK |
| `pi-check-circle` | `icon-[tabler--circle-check] size-4` | OK (`check-circle` **no existe**) |

Comprobación del naming contra `node_modules/@iconify-json/tabler/icons.json` (6462 nombres):

```
upload OK | lock OK | circle-check OK | check-circle MISS | file-type-pdf OK | file-pdf MISS
```

**Casos sin equivalente exacto: ninguno.** Las tres son directas y semánticamente idénticas.

## 3. Verificador de botones (R7) — red/green demostrado

Patrón ampliado a `/(?<![\w-])pi(?: pi)?-[a-z0-9-]*/g` y línea base reducida a los dos archivos de
prueba (3 y 2 ocurrencias). Falsos positivos del patrón nuevo sobre todo `src/app`: **cero**
(no matchea `api-`, `icon-[tabler--…]`, etc.; comprobado con un barrido dedicado).

- **Green**: `npm run check:buttons` → `Button policy: OK` (código de salida 0).
- **Red**: con un `icon="pi pi-upload"` y un `pi-trash` suelto insertados temporalmente en
  `tax-documents.page.html`, el verificador falla citando archivo:línea para **ambas** formas:

```
src/.../tax-documents.page.html:160: icono "pi pi-upload" del set pi, ... (R7)
src/.../tax-documents.page.html:160: icono "pi-trash" del set pi, ... (R7)
```

  La línea temporal se quitó con una edición puntual (sin `git checkout`); el `git diff` del archivo
  quedó con un único cambio, el `chooseIcon`.

## 4. Build y tests (`app-ngx-hub`)

```
$ npx ng build
Application bundle generation complete. [4.678 seconds]
Output: dist/ind-hub-app-ngx-pri-gh

$ npx ng test --watch=false
Test Files  92 passed (92)
     Tests  448 passed (448)
```

448 tests en verde, incluidos `button-loading.spec.ts`,
`document-preview-dialog.component.spec.ts` y `fn-iam-module-view.spec.ts`.

Advertencias de Tailwind durante el build (`Cannot find "tabler--file-pdf"`,
`Cannot find "tabler--nombre"`, `Invalid icon name: "tabler--*"`): **preexistentes y cosméticas**.
Provienen de la prosa de los documentos de tarea (`.agents/tasks/**/*.md`), que Tailwind escanea. No
son consecuencia de esta migración.

## 5. Spinners (punto A3 del plan)

`grep` de `pi-spin` y `pi-spinner` en todo `src/`: **0 resultados**. No había nada que migrar y no se
tocó ni `src/styles.css` ni los specs del spinner. El invariante de un solo spinner por botón sigue
protegido por R5 y por `button-loading.spec.ts`, ambos en verde.

## 6. Los iconos se emiten de verdad en el CSS

```
$ CSS=dist/ind-hub-app-ngx-pri-gh/browser/styles-62TCEPM4.css
icon-[tabler--upload]       -> presente
icon-[tabler--lock]         -> presente
icon-[tabler--circle-check] -> presente
primeicons -> 0 coincidencias
.pi-       -> 0 coincidencias
```

Las tres reglas son completas, no un substring casual:

```
icon-\[tabler--circle-check\]{display:inline-block;width:1em;height:1em;
 background-color:currentColor;-webkit-mask-image:var(--svg);mask-image:var(--svg);...}
```

`icon-[tabler--circle-check]` se emite pese a estar escrito en un `.ts`, lo que confirma que Tailwind
escanea `.ts` y que **no** hizo falta tocar el `@source inline(...)` de `styles.css`.

## 7. Verificación visual

**Render real de los tres iconos: VERIFICADO.** Con Google Chrome en modo headless (ya instalado en
la máquina, no se instaló nada) se renderizó una página que carga el CSS compilado del bundle y
declara los tres spans con las clases exactas de la migración. Captura: `/tmp/iconcheck/shot.png`
(200×140). Los tres iconos se dibujan correctamente: flecha de carga, candado y check circular,
cada uno de ~16 px y en negro, heredando el color del texto.

**NO VERIFICADO: las pantallas reales de la aplicación.** Están detrás de autenticación y no hay
sesión disponible en este entorno, así que no se comprobaron en vivo:

- formulario de contrato: banner de contrato bloqueado, “Cargar Excel”, “Cargar contrato firmado”;
- documentos tributarios: “Seleccionar PDF”;
- visor de PDF con contrato en `PENDING_APPROVAL`: “Aprobar contrato”.

Queda pendiente de revisión del usuario, en modo claro y oscuro y a 320/390/tablet/escritorio: la
alineación vertical del candado del banner (`align-text-bottom`; si queda alto o bajo, el ajuste
previsto es `align-[-0.1875em]`) y que los tres `p-fileupload` conserven su etiqueta sin estrecharse.

**Cambio visual esperado y deliberado**: las cinco migraciones hacen aparecer iconos donde hoy no se
ve ninguno (las clases `pi` eran inertes). Tres botones de carga pasan de solo texto a icono + texto,
el banner de contrato bloqueado gana un candado y “Aprobar contrato” gana un check circular.

## 8. Steering (`ind-hub-orc`)

### Verificación que cambió la ubicación de la regla

`app-ngx-web` **sí usa PrimeIcons**, verificado en el repo:

```
package.json:37:    "primeicons": "^7.0.0",
src/styles.css:5:@import 'primeicons/primeicons.css';
node_modules/primeicons  (instalado)
19 ocurrencias `pi pi-*` activas en 4 archivos
```

Por lo tanto una prohibición global de `pi` habría sido **una afirmación falsa** capaz de mandar a
un agente a romper un sitio en producción. La regla se sacó de `global-context` y se acotó a los dos
repos donde se verificó que `primeicons` no está instalado y que el CSS compilado no tiene ninguna
regla `.pi-*`.

### Fuentes editadas (ninguna con cabecera `AUTO-GENERATED`)

- `ai/source/repo-overrides/app-ngx-hub.md` y `app-ngx-pay.md`: **la regla completa**, dos viñetas
  por repo. Para el Hub esto es tan activo como el charter: ambos llegan por el mismo canal, el
  `AGENTS.md` del repo, que se carga automáticamente. El charter **no** produce un
  `.kiro/steering/agent-charter.md` en los repos consumidores.
- `ai/source/repo-overrides/app-ngx-web.md`: una línea que declara PrimeIcons como su set y dice
  explícitamente que la prohibición de Hub y Pay **no** aplica ahí.
- `ai/source/global-context/agent-charter.md`: una sola línea, sin prohibición y verdadera para
  todos — cada frontend usa el set que declara su `package.json` y la regla concreta vive en el
  contexto de cada repo.
- `docs/standards/frontend/design-system-usage.md`: sección `## Sistema de iconos` con **solo
  mecánica** (paquetes por repo, forma y tamaño de la clase, patrón por tipo de uso, el caso
  `p-fileupload` avanzado donde PrimeNG inyecta un `pi` inevitable, `@source inline` para nombres
  que llegan de DynamoDB, cómo comprobar el CSS emitido). No repite el texto de la regla: la
  referencia. `last-updated: 2026-10-19`.

### Propagación aplicada (acotada)

`sync-context.sh --repo app-ngx-hub` y `--repo app-ngx-pay`. La regla quedó en `AGENTS.md`,
`.claude/CLAUDE.md`, `.gemini/GEMINI.md` y `.claude/rules/repo-rules.md` de ambos repos.
`app-ngx-web`, `ind-hub-api`, `ind-hub-iam` e `ind-hub-inf` quedaron **sin tocar** (0 archivos
modificados). `grep 'PrimeIcons está prohibido' giras_indomito_ng_dev_pub_usw2/AGENTS.md` → 0.

Los cambios ajenos que arrastraba el sync están documentados en
`cambios-ajenos-no-propagados.md`, en este mismo directorio.

### Validación

`sync-context.sh --validate-only` sigue fallando **solo** por
`docs/standards/api-khipu-renditions.md` (sin front matter), error preexistente del commit
`ed8309a` y ajeno a esta tarea. El estándar editado aquí no genera errores ni advertencias.

`npm run check:buttons` → `Button policy: OK` tras todos los cambios. El build y los 448 tests no se
repitieron después de esta sección porque no se modificó nada de `src/` ni de `tools/` desde la
corrida registrada en los puntos 3 y 4.
