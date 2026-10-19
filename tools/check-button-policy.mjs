import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/*
 * Política de botones del Hub.
 *
 * Reglas:
 *   R1 — todo <button> debe llevar la directiva pButton.
 *   R2 — todo <a> que dispara una acción con (click) debe llevar pButton,
 *        salvo las excepciones listadas en NAVIGATION_ANCHORS.
 *   R3 — todo <button pButton> / <a pButton> debe tener contenido visible
 *        (texto, interpolación o un elemento hijo).
 *   R4 — sobre la directiva pButton no se admiten atributos que solo existen
 *        como inputs del componente <p-button>: label, icon, iconPos, badge y
 *        loadingIcon son HTML inerte y no renderizan nada.
 *   R6 — un hijo pButtonIcon no puede convivir con texto visible en el mismo
 *        host pButton. La directiva infiere icon-only con
 *        `!labelSignal() && iconSignal()` y el repositorio no marca sus
 *        etiquetas con pButtonLabel, así que el atributo colapsaría el botón
 *        al ancho cuadrado de icon-only con el texto desbordando. El icono
 *        debe ir como hijo desnudo, que es además lo que indica la nota
 *        @deprecated de pButtonIcon desde v21.
 *   R5 — la regla global del spinner en src/styles.css debe seguir acotada con
 *        :not([data-p]), para que el componente <p-button> no muestre dos
 *        indicadores (el suyo más el ::before global). jsdom no evalúa
 *        pseudo-elementos, así que esta garantía no puede vivir en un spec.
 *   R7 — ninguna referencia nueva al set de iconos PrimeIcons, ni en la forma
 *        `pi pi-*` ni como `pi-*` suelto. Este proyecto no instala
 *        `primeicons` ni lo importa: usa Iconify/Tabler (prefijo "icon-" más
 *        el nombre Tabler entre corchetes). Una clase `pi` no renderiza nada
 *        y, como el root del botón declara `gap`, el span queda como ítem
 *        flex vacío y mete medio rem de aire antes del texto. La deuda de
 *        producción ya está en cero: lo único que admite LEGACY_PI_ICONS, con
 *        recuento exacto, es material de prueba que necesita el string `pi`
 *        como dato de entrada o como aserción negativa.
 *
 * No se exige [loading]: en PrimeNG 22 ese input de la directiva está marcado
 * @deprecated con la indicación de manejar el estado con `disabled`, así que
 * exigirlo empujaba el repositorio en contra de la librería.
 */

const projectRoot = process.cwd();
const templatesRoot = join(projectRoot, 'src/app');

/**
 * Anclas de navegación con (click) que no son botones y por eso no llevan
 * pButton. Cada entrada debe justificarse al agregarse.
 */
const NAVIGATION_ANCHORS = new Set([
  // Tarjeta de navegación del mega menú: es un <a [routerLink]> con estilo de
  // tarjeta; el (click) solo cierra el panel abierto.
  'src/app/core/layout/app-mega-menu/app-mega-menu.component.html',
]);

/** Atributos que solo son inputs del componente <p-button>, nunca de la directiva. */
const INERT_ATTRIBUTES = ['label', 'icon', 'iconPos', 'badge', 'loadingIcon'];

/** Referencias a PrimeIcons: `pi pi-x` y también un `pi-x` suelto. */
const PI_ICON_PATTERN = /(?<![\w-])pi(?: pi)?-[a-z0-9-]*/g;

/**
 * Único inventario admitido de referencias a PrimeIcons, con el recuento
 * exacto por archivo. Es una línea base, no una exención: cualquier referencia
 * nueva —en un archivo listado o no— hace fallar R7. Ya no queda deuda en
 * código de producción; las entradas que siguen son material de prueba que
 * necesita el string `pi` para cumplir su función.
 */
const LEGACY_PI_ICONS = new Map([
  // Casos de prueba del mapeador: el valor `pi`, almacenado en DynamoDB, es el
  // dato de entrada que prueba la defensa de resolveIamModuleIcon().
  ['src/app/indomito-hub/administration/iam/fn/fn-iam-module-view.spec.ts', 3],
  // Mención en prosa dentro de un comentario, más la aserción negativa que
  // garantiza que el visor no reintroduzca un icono `pi`.
  [
    'src/app/shared/documents/components/document-preview-dialog/document-preview-dialog.component.spec.ts',
    2,
  ],
]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return file.endsWith('.html') || file.endsWith('.ts') ? [file] : [];
  });
}

/**
 * Devuelve las regiones de plantilla a analizar dentro de un archivo. Para
 * `.html` es el archivo completo; para `.ts` son los literales de `template:`,
 * cuyo desplazamiento se conserva para calcular el número de línea real.
 */
function templateRegions(file, source) {
  if (file.endsWith('.html')) return [{ text: source, offset: 0 }];
  const regions = [];
  const marker = /template\s*:\s*`/g;
  for (const match of source.matchAll(marker)) {
    const start = match.index + match[0].length;
    let index = start;
    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2;
        continue;
      }
      if (source[index] === '`') break;
      index += 1;
    }
    regions.push({ text: source.slice(start, index), offset: start });
  }
  return regions;
}

/**
 * Recorre las etiquetas de apertura de `tagName` respetando las comillas de los
 * valores de atributo, para que un `>` dentro de una expresión de Angular no
 * corte la etiqueta antes de tiempo.
 */
function openTags(text, tagName) {
  const tags = [];
  const opener = new RegExp(`<${tagName}(?=[\\s/>])`, 'g');
  for (const match of text.matchAll(opener)) {
    let index = match.index + match[0].length;
    let quote = null;
    while (index < text.length) {
      const char = text[index];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
      index += 1;
    }
    tags.push({ tag: text.slice(match.index, index + 1), start: match.index, end: index + 1 });
  }
  return tags;
}

/** Contenido hasta la etiqueta de cierre correspondiente, con anidamiento. */
function innerContent(text, tagName, contentStart) {
  const scanner = new RegExp(`<${tagName}(?=[\\s/>])|</${tagName}\\s*>`, 'g');
  scanner.lastIndex = contentStart;
  let depth = 0;
  let match;
  while ((match = scanner.exec(text)) !== null) {
    if (match[0].startsWith('</')) {
      if (depth === 0) return text.slice(contentStart, match.index);
      depth -= 1;
    } else {
      depth += 1;
    }
  }
  return text.slice(contentStart);
}

/** Texto propio del botón, descontando comentarios, etiquetas y bloques de control. */
function ownText(inner) {
  return inner
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/@(?:if|else|for|switch|case|default|empty|placeholder|loading|error)\b[^{]*\{/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** Un botón es visible si tiene algún elemento hijo o algún texto no vacío. */
function hasVisibleContent(inner) {
  const withoutComments = inner.replace(/<!--[\s\S]*?-->/g, '');
  if (/<[a-zA-Z]/.test(withoutComments)) return true;
  const text = withoutComments
    .replace(/@(?:if|else|for|switch|case|default|empty|placeholder|loading|error)\b[^{]*\{/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text.length > 0;
}

const violations = [];

for (const file of sourceFiles(templatesRoot)) {
  const relativePath = relative(projectRoot, file);
  const source = readFileSync(file, 'utf8');

  // R7 — referencias al set de iconos `pi`, que este proyecto no instala.
  const piMatches = [...source.matchAll(PI_ICON_PATTERN)];
  const piAllowed = LEGACY_PI_ICONS.get(relativePath) ?? 0;
  if (piMatches.length > piAllowed) {
    for (const match of piMatches.slice(piAllowed)) {
      violations.push(
        `${relativePath}:${source.slice(0, match.index).split('\n').length}: icono "${match[0]}" del set pi, que este proyecto no instala; no renderiza nada y deja un hueco flex. Usa el set Iconify de Tabler (R7)`,
      );
    }
  }

  for (const region of templateRegions(file, source)) {
    const lineAt = (index) => source.slice(0, region.offset + index).split('\n').length;

    for (const tagName of ['button', 'a']) {
      for (const { tag, start, end } of openTags(region.text, tagName)) {
        const location = `${relativePath}:${lineAt(start)}`;
        const isDirective = /\bpButton\b/.test(tag);

        if (tagName === 'button' && !isDirective) {
          violations.push(`${location}: <button> sin la directiva pButton (R1)`);
        }

        if (
          tagName === 'a' &&
          !isDirective &&
          /\(click\)=/.test(tag) &&
          !NAVIGATION_ANCHORS.has(relativePath)
        ) {
          violations.push(`${location}: <a> con (click) sin la directiva pButton (R2)`);
        }

        if (!isDirective) continue;

        // Un velo a pantalla completa ([unstyled] + nombre accesible) no debe
        // tener etiqueta visible: renuncia al render de PrimeNG y solo captura
        // el clic. Sin nombre accesible sí es una violación.
        const isAccessibleScrim =
          /\[unstyled\]="true"/.test(tag) && /(?:\[attr\.)?aria-label\]?\s*=/.test(tag);

        const inner = innerContent(region.text, tagName, end);

        if (!isAccessibleScrim && !hasVisibleContent(inner)) {
          violations.push(
            `${location}: <${tagName} pButton> sin contenido visible; la directiva no renderiza label ni icon (R3)`,
          );
        }

        if (/\bpButtonIcon\b/.test(inner) && ownText(inner).length > 0 && !/\biconOnly\b/.test(tag)) {
          violations.push(
            `${location}: hijo con pButtonIcon junto a texto visible; la directiva lo infiere icon-only y colapsa el ancho del botón. Deja el icono como hijo desnudo (R6)`,
          );
        }

        for (const attribute of INERT_ATTRIBUTES) {
          const inert = new RegExp(`(?:^|[\\s])\\[?${attribute}\\]?\\s*=`);
          if (inert.test(tag)) {
            violations.push(
              `${location}: atributo inerte "${attribute}" sobre la directiva pButton; usa un hijo visible o el componente <p-button> (R4)`,
            );
          }
        }
      }
    }
  }
}

// R7 — la línea base solo puede encogerse: si un archivo listado ya tiene menos
// referencias `pi` de las declaradas, hay que ajustar LEGACY_PI_ICONS para que
// el inventario no vuelva a crecer sin que nadie lo note.
for (const [path, expected] of LEGACY_PI_ICONS) {
  const actual = [...readFileSync(join(projectRoot, path), 'utf8').matchAll(PI_ICON_PATTERN)].length;
  if (actual < expected) {
    violations.push(
      `${path}: LEGACY_PI_ICONS declara ${expected} referencias "pi" y quedan ${actual}; baja el recuento (o quita la entrada) para que la línea base no se afloje (R7)`,
    );
  }
}

// R5 — el acotamiento de la regla global del spinner.
const globalStylesPath = 'src/styles.css';
const spinnerRules = readFileSync(join(projectRoot, globalStylesPath), 'utf8')
  .split('\n')
  .map((line, index) => ({ line: line.trim(), number: index + 1 }))
  .filter(({ line }) => line.startsWith('button.p-button-loading'));

if (spinnerRules.length === 0) {
  violations.push(`${globalStylesPath}: falta la regla del spinner de la directiva pButton (R5)`);
}
for (const { line, number } of spinnerRules) {
  if (!line.includes(':not([data-p])')) {
    violations.push(
      `${globalStylesPath}:${number}: la regla del spinner no está acotada con :not([data-p]); el componente <p-button> mostraría dos indicadores (R5)`,
    );
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Button policy: OK');
}
