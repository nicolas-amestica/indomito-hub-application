import { Directive, ElementRef, OnDestroy, Renderer2, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

/** Muestra junto al control el mensaje de obligatoriedad una vez visitado o validado. */
@Directive({ selector: '[formControlName]' })
export class RequiredFieldMessageDirective implements OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly control = inject(NgControl);
  private readonly renderer = inject(Renderer2);
  private readonly subscription = new Subscription();
  private message: HTMLElement | null = null;

  constructor() {
    this.subscription.add(this.control.control?.events.subscribe(() => this.render()));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.removeMessage();
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
    this.renderer.addClass(message, 'text-red-600');
    this.renderer.addClass(message, 'dark:text-red-400');
    this.renderer.setAttribute(message, 'role', 'alert');
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
