import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvatarComponent } from '../../shared/avatar.component';

@Component({
  selector: 'app-profile-settings',
  imports: [ReactiveFormsModule, RouterLink, AvatarComponent],
  templateUrl: './profile-settings.component.html',
  styleUrl: './profile-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsComponent {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly MAX_BIO = 280;

  readonly form = this.fb.nonNullable.group({
    displayName: [this.auth.currentUser()?.displayName ?? '', [Validators.required, Validators.maxLength(60)]],
    bio: [this.auth.currentUser()?.bio ?? '', [Validators.maxLength(280)]],
  });

  readonly avatarPreview = signal<string | null>(this.auth.currentUser()?.avatarUrl ?? null);
  readonly avatarError = signal<string | null>(null);
  readonly saved = signal(false);
  readonly submitted = signal(false);
  readonly saving = signal(false);

  /** Pending avatar file, uploaded as multipart when the form is saved. */
  private readonly avatarFile = signal<File | null>(null);
  /** True when the member cleared their avatar and the change is unsaved. */
  private readonly avatarCleared = signal(false);

  readonly bioRemaining = computed(() => this.MAX_BIO - (this.form.controls.bio.value?.length ?? 0));
  readonly showModerationLinks = computed(() => this.auth.isModerator());
  readonly profileLink = computed(() => `/u/${this.auth.currentUser()?.handle ?? 'alice'}`);

  get nameInvalid(): boolean {
    const control = this.form.controls.displayName;
    return control.invalid && (control.touched || this.submitted());
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.avatarError.set(null);
    if (!file) {
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.avatarError.set('Avatars must be a JPEG or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('Image exceeds 5 MB');
      return;
    }
    this.avatarFile.set(file);
    this.avatarCleared.set(false);
    this.avatarPreview.set(URL.createObjectURL(file));
  }

  removeAvatar(): void {
    this.avatarPreview.set(null);
    this.avatarFile.set(null);
    this.avatarCleared.set(true);
    this.avatarError.set(null);
  }

  /**
   * PATCH /api/users/me, then PUT /api/users/me/avatar when a new image was
   * picked. Both are scoped server-side to the bearer token's own account, so
   * nothing here can touch another member's profile.
   */
  async save(): Promise<void> {
    this.submitted.set(true);
    this.saved.set(false);
    this.avatarError.set(null);
    if (this.form.invalid || this.saving()) {
      return;
    }
    const { displayName, bio } = this.form.getRawValue();

    this.saving.set(true);
    try {
      const problem = await this.auth.saveProfile({ displayName, bio: bio || null });
      if (problem) {
        this.avatarError.set(problem);
        return;
      }
      const file = this.avatarFile();
      if (file) {
        const avatarProblem = await this.auth.saveAvatar(file);
        if (avatarProblem) {
          this.avatarError.set(avatarProblem);
          return;
        }
        this.avatarFile.set(null);
      } else if (this.avatarCleared()) {
        // No delete endpoint exists; clearing is a local presentation choice
        // until a replacement image is uploaded.
        this.auth.applyLocalProfile({ avatarUrl: null });
        this.avatarCleared.set(false);
      }
      this.avatarPreview.set(this.auth.currentUser()?.avatarUrl ?? null);
      this.saved.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  signOut(): void {
    this.auth.logout();
  }
}
