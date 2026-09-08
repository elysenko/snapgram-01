import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);

  /** Bound from ?returnUrl= by withComponentInputBinding(). */
  readonly returnUrl = input<string | undefined>(undefined);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);

  /**
   * Preview-only shortcut label. Held in TypeScript behind the build-time
   * constant so the button and its text are dead-code-eliminated from the
   * production bundle rather than shipping as a hidden template branch.
   */
  readonly previewShortcut = COLOSSUS_PREVIEW ? 'Skip login — Demo Mode' : null;

  get emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && (control.touched || this.submitted());
  }

  get passwordInvalid(): boolean {
    const control = this.form.controls.password;
    return control.invalid && (control.touched || this.submitted());
  }

  submit(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    if (this.form.invalid) {
      return;
    }
    const { email, password } = this.form.getRawValue();
    const problem = this.auth.login(email, password, this.returnUrl() ?? null);
    if (problem) {
      this.serverError.set(problem);
    }
  }

  /** Seeds the signed-in state directly — no credentials involved. */
  useDemoMode(): void {
    if (!COLOSSUS_PREVIEW) {
      return;
    }
    this.auth.previewSignIn();
    void this.router.navigateByUrl(this.returnUrl() ?? '/feed');
  }
}
