import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string | undefined>(undefined);

  readonly form = this.fb.nonNullable.group(
    {
      displayName: ['', [Validators.required, Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);

  /**
   * Preview-only shortcut label. Held in TypeScript behind the build-time
   * COLOSSUS_PREVIEW constant so the button and its text are dead-code-eliminated
   * from the production bundle rather than shipping as a hidden template branch.
   */
  readonly previewShortcut = COLOSSUS_PREVIEW ? 'Skip signup — Demo Mode' : null;

  invalid(name: 'displayName' | 'email' | 'password' | 'confirmPassword'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  get mismatch(): boolean {
    return this.form.hasError('mismatch') && (this.form.controls.confirmPassword.touched || this.submitted());
  }

  readonly submitting = signal(false);

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.serverError.set(null);
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    const { displayName, email, password } = this.form.getRawValue();
    try {
      const problem = await this.auth.signup(displayName, email, password, this.returnUrl() ?? null);
      if (problem) {
        this.serverError.set(problem);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  /** Seeds a local, credential-free preview session — see AuthService.previewSignIn. */
  useDemoMode(): void {
    if (!COLOSSUS_PREVIEW) {
      return;
    }
    this.auth.previewSignIn();
    void this.router.navigateByUrl(this.returnUrl() ?? '/feed');
  }
}
