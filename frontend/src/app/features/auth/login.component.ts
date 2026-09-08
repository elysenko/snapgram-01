import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Bound from ?returnUrl= by withComponentInputBinding(). */
  readonly returnUrl = input<string | undefined>(undefined);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    // Length is a *signup* rule. Sign-in only requires a non-empty secret:
    // platform-minted demo credentials are outside our control, and rejecting
    // them here would fail the login before the server ever sees it.
    password: ['', [Validators.required]],
  });

  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);

  get emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && (control.touched || this.submitted());
  }

  get passwordInvalid(): boolean {
    const control = this.form.controls.password;
    return control.invalid && (control.touched || this.submitted());
  }

  readonly submitting = signal(false);

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    try {
      const problem = await this.auth.login(email, password, this.returnUrl() ?? null);
      if (problem) {
        this.serverError.set(problem);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
