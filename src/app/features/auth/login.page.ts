import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    login: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(254)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });
  async submit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.form.controls.login.value, this.form.controls.password.value);
    } catch {
      this.error.set('No pudimos iniciar sesión. Revisa tu RUT o correo y clave.');
    } finally {
      this.loading.set(false);
    }
  }
}
