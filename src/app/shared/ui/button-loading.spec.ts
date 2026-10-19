import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button, ButtonDirective, ButtonIcon } from 'primeng/button';
import { describe, expect, it } from 'vitest';

/**
 * Contrato de un solo spinner.
 *
 * El Hub tiene dos formas de botón en estado de carga y cada una obtiene su
 * indicador por una vía distinta:
 *
 * - El componente `<p-button [loading]>` renderiza su propio
 *   `svg[data-p-icon="spinner"]` y además expone `data-p` en su `<button>`
 *   interno, atributo cuyo valor incluye el término `loading`.
 * - La directiva `<button pButton [loading]>` no renderiza nada: solo aplica la
 *   clase `p-button-loading`. Su indicador lo aporta la regla global
 *   `button.p-button-loading:not([data-p])::before` de `src/styles.css`.
 *
 * El contrato se mide por el discriminador real del DOM — si el `<button>`
 * expone `data-p` — y no contando píxeles, porque jsdom no evalúa
 * pseudo-elementos y el `::before` global no es observable aquí. Que la regla
 * de `src/styles.css` siga acotada con `:not([data-p])` lo verifica la regla R5
 * de `tools/check-button-policy.mjs`, que sí puede leer la hoja de estilos.
 */

@Component({
  standalone: true,
  imports: [Button],
  template: `<p-button label="Guardar" [loading]="true" />`,
})
class ComponentLoadingHost {}

@Component({
  standalone: true,
  imports: [ButtonDirective],
  template: `<button pButton type="button" [loading]="true">Guardar</button>`,
})
class DirectiveLoadingHost {}

/**
 * Contrato de ancho: la directiva infiere icon-only con
 * `!labelSignal() && iconSignal()`, y el repositorio no marca sus etiquetas con
 * `pButtonLabel`. Por eso un hijo con `pButtonIcon` junto a texto visible
 * colapsa el botón al ancho cuadrado de icon-only, con `padding-inline` y `gap`
 * en cero y el texto desbordando. El icono debe ir como hijo desnudo.
 */
@Component({
  standalone: true,
  imports: [ButtonDirective],
  template: `<button pButton type="button">
    <span class="icon-[tabler--file-type-pdf] size-4" aria-hidden="true"></span>
    Ver PDF
  </button>`,
})
class LabeledIconHost {}

@Component({
  standalone: true,
  imports: [ButtonDirective, ButtonIcon],
  template: `<button pButton type="button" aria-label="Cerrar">
    <span pButtonIcon class="icon-[tabler--x] size-5" aria-hidden="true"></span>
  </button>`,
})
class IconOnlyHost {}

/** Indicadores que PrimeNG renderiza por sí mismo dentro del botón. */
function ownIndicators(root: HTMLElement): number {
  return root.querySelectorAll('svg[data-p-icon="spinner"], .p-button-loading-icon').length;
}

describe('contrato de carga de los botones', () => {
  it('el componente <p-button [loading]> aporta su único indicador y queda fuera de la regla global', async () => {
    const fixture = TestBed.createComponent(ComponentLoadingHost);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.classList.contains('p-button-loading')).toBe(true);
    expect(ownIndicators(fixture.nativeElement)).toBe(1);
    // Con `data-p` presente, `:not([data-p])` excluye el `::before` global: 1 + 0 = 1.
    expect(button.hasAttribute('data-p')).toBe(true);
    expect(button.getAttribute('data-p')).toContain('loading');
  });

  it('la directiva [pButton][loading] no renderiza indicador propio y sí recibe el global', async () => {
    const fixture = TestBed.createComponent(DirectiveLoadingHost);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.classList.contains('p-button-loading')).toBe(true);
    expect(ownIndicators(fixture.nativeElement)).toBe(0);
    // Sin `data-p`, la regla global aplica y aporta el único indicador: 0 + 1 = 1.
    expect(button.hasAttribute('data-p')).toBe(false);
  });
});

describe('contrato de ancho de los botones de la directiva', () => {
  it('un botón con icono desnudo y etiqueta no se infiere icon-only', async () => {
    const fixture = TestBed.createComponent(LabeledIconHost);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    // Sin esta garantía el botón quedaría en un cuadrado de 2.5rem (2rem con
    // size="small") y el texto se saldría de la caja.
    expect(button.classList.contains('p-button-icon-only')).toBe(false);
    expect(button.textContent?.trim()).toContain('Ver PDF');
  });

  it('un botón sin etiqueta y con pButtonIcon sí se infiere icon-only', async () => {
    const fixture = TestBed.createComponent(IconOnlyHost);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.classList.contains('p-button-icon-only')).toBe(true);
  });
});
