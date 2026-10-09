import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-request-password-reset',
  imports: [ReactiveFormsModule, RouterLink, ButtonDirective, InputText, Message],
  templateUrl: './request-password-reset.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestPasswordResetPage {
  private readonly auth = inject(AuthService);
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.requestPasswordReset(this.form.controls.email.value);
      this.sent.set(true);
    } catch {
      this.error.set('No pudimos procesar la solicitud. Inténtalo nuevamente en unos minutos.');
    } finally {
      this.loading.set(false);
    }
  }
}
