import { TestBed } from '@angular/core/testing';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentPreviewDialogComponent } from './document-preview-dialog.component';

/**
 * Contraste de las pestañas del visor de documentos.
 *
 * Las pestañas inactivas son `outlined` con severity `secondary`. Aura resuelve
 * su borde en modo claro a `{surface.200}`, que el preset mapea a
 * `var(--color-line)` = #E2E3E5: 1.28:1 sobre el blanco del panel, por debajo
 * del mínimo de 3:1 de WCAG 1.4.11 para límites de componentes.
 *
 * La corrección es por instancia — token semántico `control-border` vía
 * utilidad de Tailwind — y no toca el token global de `outlined-secondary`,
 * que lo comparten botones de todo el Hub. Se usa el modificador `!` de
 * Tailwind, igual que el resto del repositorio, para no depender del orden
 * entre la capa `utilities` y la capa `primeng` que PrimeNG inyecta en runtime.
 *
 * La pestaña activa es `primary` llena y no debe recibir el borde: su contorno
 * es el de la marca.
 */
describe('DocumentPreviewDialogComponent — contraste de pestañas', () => {
  const INACTIVE_BORDER = 'border-control-border!';

  function mount(documentCount: number) {
    const documents = Array.from({ length: documentCount }, (_, index) => ({
      name: `documento-${index}.pdf`,
      mimeType: 'application/pdf',
      source: `https://example.test/${index}.pdf`,
    }));

    TestBed.configureTestingModule({
      providers: [
        { provide: DynamicDialogConfig, useValue: { data: { documents, title: 'Visor' } } },
        { provide: DynamicDialogRef, useValue: { close: () => undefined } },
      ],
    });

    return TestBed.createComponent(DocumentPreviewDialogComponent);
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('marca con el borde reforzado solo las pestañas inactivas', async () => {
    const fixture = mount(3);
    await fixture.whenStable();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('nav button'),
    ) as HTMLButtonElement[];
    expect(tabs).toHaveLength(3);

    // La primera es la activa por defecto: su contorno es el de la marca.
    expect(tabs[0].classList.contains(INACTIVE_BORDER)).toBe(false);
    expect(tabs[1].classList.contains(INACTIVE_BORDER)).toBe(true);
    expect(tabs[2].classList.contains(INACTIVE_BORDER)).toBe(true);
  });

  it('mueve el borde reforzado al cambiar de pestaña', async () => {
    const fixture = mount(2);
    await fixture.whenStable();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('nav button'),
    ) as HTMLButtonElement[];
    tabs[1].click();
    await fixture.whenStable();

    expect(tabs[0].classList.contains(INACTIVE_BORDER)).toBe(true);
    expect(tabs[1].classList.contains(INACTIVE_BORDER)).toBe(false);
    expect(tabs[1].getAttribute('aria-current')).toBe('true');
  });

  it('el botón de cerrar conserva su nombre accesible y un icono visible', async () => {
    const fixture = mount(1);
    await fixture.whenStable();

    const close = fixture.nativeElement.querySelector(
      'button[aria-label="Cerrar visor"]',
    ) as HTMLButtonElement;

    expect(close).toBeTruthy();
    // El icono debe venir del sistema real del repositorio (Iconify/Tabler);
    // las clases `pi pi-*` no tienen hoja de estilos en este proyecto.
    const icon = close.querySelector('span');
    expect(icon?.className).toContain('icon-[tabler--x]');
    expect(icon?.className).not.toContain('pi-times');
  });
});
