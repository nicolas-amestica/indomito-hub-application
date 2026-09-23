import { Directive } from '@angular/core';

/** Respuesta visual breve y reutilizable para controles que disparan navegación o paneles. */
@Directive({
  selector: '[appMotionPress]',
  host: {
    class:
      'transition-[transform,background-color,color,border-color,box-shadow] duration-200 ease-out active:scale-[0.985]',
  },
})
export class MotionPressDirective {}
