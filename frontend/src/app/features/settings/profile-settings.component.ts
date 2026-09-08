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

  readonly bioRemaining = computed(() => this.MAX_BIO - (this.form.controls.bio.value?.length ?? 0));
  readonly showModerationLinks = computed(() => COLOSSUS_PREVIEW || this.auth.isModerator());
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
    this.avatarPreview.set(URL.createObjectURL(file));
  }

  removeAvatar(): void {
    this.avatarPreview.set(null);
    this.avatarError.set(null);
  }

  save(): void {
    this.submitted.set(true);
    this.saved.set(false);
    if (this.form.invalid) {
      return;
    }
    const { displayName, bio } = this.form.getRawValue();
    this.auth.updateProfile({ displayName, bio: bio || null, avatarUrl: this.avatarPreview() });
    this.saved.set(true);
  }

  signOut(): void {
    this.auth.logout();
  }
}
