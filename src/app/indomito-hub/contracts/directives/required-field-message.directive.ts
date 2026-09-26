import { AfterViewInit, Directive, ElementRef, OnDestroy, Renderer2, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

/** Muestra junto al control el mensaje de obligatoriedad una vez visitado o validado. */
@Directive({ selector: '[formControlName]' })
export class RequiredFieldMessageDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly control = inject(NgControl);
  private readonly renderer = inject(Renderer2);
  private readonly subscription = new Subscription();
  private message: HTMLElement | null = null;
  private stopFocusOut: (() => void) | null = null;

  ngAfterViewInit(): void {
    this.subscription.add(this.control.control?.events.subscribe(() => this.render()));
    this.stopFocusOut = this.renderer.listen(this.element.nativeElement, 'focusout', () => {
      this.control.control?.markAsTouched();
      this.render();
    });
    this.render();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.stopFocusOut?.();
    this.removeMessage();
  }

  /** Fuerza la sincronización después de acciones globales como markAllAsTouched. */
  refresh(): void {
    this.render();
  }

  private render(): void {
    const control = this.control.control;
    const show = Boolean(control?.touched && control.hasError('required'));
    this.renderer.setAttribute(this.element.nativeElement, 'aria-invalid', String(show));
    if (!show) {
      this.removeMessage();
      return;
    }
    if (this.message) return;

    const message = this.renderer.createElement('small') as HTMLElement;
    this.renderer.addClass(message, 'mt-1');
    this.renderer.addClass(message, 'block');
    this.renderer.addClass(message, 'text-sm');
    this.renderer.addClass(message, 'text-red-700');
    this.renderer.addClass(message, 'dark:text-red-400');
    this.renderer.setAttribute(message, 'aria-live', 'polite');
    this.renderer.appendChild(message, this.renderer.createText('Este campo es obligatorio.'));
    this.renderer.appendChild(this.element.nativeElement.parentElement, message);
    this.message = message;
  }

  private removeMessage(): void {
    if (!this.message) return;
    this.renderer.removeChild(this.message.parentElement, this.message);
    this.message = null;
  }
}
