import { animate, style, transition, trigger } from '@angular/animations';

/** Movimiento compartido para paneles laterales que aparecen desde la derecha. */
export const slidePanelMotion = trigger('slidePanelMotion', [
  transition(':enter', [
    style({ opacity: 0.7, transform: 'translateX(100%)' }),
    animate(
      '260ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateX(0)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      '200ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'translateX(100%)' }),
    ),
  ]),
]);

/** Fundido compartido para las capas que acompañan paneles y diálogos. */
export const fadeOverlayMotion = trigger('fadeOverlayMotion', [
  transition(':enter', [style({ opacity: 0 }), animate('200ms ease-out', style({ opacity: 1 }))]),
  transition(':leave', [animate('160ms ease-in', style({ opacity: 0 }))]),
]);
