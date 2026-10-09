import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { AuthService } from '../../../../core/auth/auth.service';
import { passwordsMatchValidator } from '../../validators/passwords-match.validator';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, ButtonDirective, InputText, Message],
  templateUrl: './reset-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly invalidLink = signal(!this.token);
  readonly loading = signal(false);
  readonly completed = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup(
    {
      password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)] }),
      confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: passwordsMatchValidator },
  );

  async submit(): Promise<void> {
    if (!this.token || this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.resetPassword(this.token, this.form.controls.password.value);
      this.completed.set(true);
    } catch {
      this.error.set('El enlace no es válido, ya fue utilizado o expiró. Solicita uno nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
