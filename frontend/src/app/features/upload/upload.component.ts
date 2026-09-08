import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api-error';
import { PostsApi } from '../../shared/api/posts-api.service';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png'];

@Component({
  selector: 'app-upload',
  imports: [FormsModule, RouterLink],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadComponent {
  private readonly router = inject(Router);
  private readonly postsApi = inject(PostsApi);
  readonly auth = inject(AuthService);

  readonly MAX_CAPTION = 2200;
  readonly maxLabel = '5 MB';

  /** The selected file, held until submit so it can be posted as multipart. */
  private readonly file = signal<File | null>(null);
  /** Id of the created post, used to link straight to it after upload. */
  readonly createdId = signal<string | null>(null);

  readonly fileName = signal<string | null>(null);
  readonly fileSize = signal<number>(0);
  readonly previewUrl = signal<string | null>(null);
  readonly caption = signal('');
  readonly dragging = signal(false);
  readonly submitting = signal(false);
  readonly success = signal(false);
  /** Mirrors the backend's 400 body message. */
  readonly serverError = signal<string | null>(null);

  readonly remaining = computed(() => this.MAX_CAPTION - this.caption().length);
  readonly readableSize = computed(() => `${(this.fileSize() / (1024 * 1024)).toFixed(2)} MB`);
  readonly canSubmit = computed(() => this.previewUrl() !== null && !this.serverError() && !this.submitting());

  onCaption(value: string): void {
    this.caption.set(value);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(): void {
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.accept(file);
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.accept(file);
    }
  }

  clear(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.previewUrl.set(null);
    this.fileName.set(null);
    this.fileSize.set(0);
    this.file.set(null);
    this.serverError.set(null);
  }

  /** Client-side precheck mirroring the server's magic-byte + size validation. */
  private accept(file: File): void {
    this.clear();
    this.fileName.set(file.name);
    this.fileSize.set(file.size);

    if (!ACCEPTED.includes(file.type)) {
      this.serverError.set('Only JPEG and PNG images are supported.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.serverError.set('Image exceeds 5 MB');
      return;
    }
    this.file.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  /**
   * POST /api/posts (multipart).
   *
   * The client-side precheck above mirrors the server's rules, but the server
   * is still the authority: a 400 it raises — oversize body, magic bytes that
   * are not JPEG/PNG — is surfaced verbatim in the same banner.
   */
  async submit(): Promise<void> {
    if (!this.canSubmit()) {
      if (!this.previewUrl() && !this.serverError()) {
        this.serverError.set('Choose a JPEG or PNG image to post.');
      }
      return;
    }

    const file = this.file();
    if (!file) {
      this.serverError.set('Choose a JPEG or PNG image to post.');
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);
    try {
      const post = await this.postsApi.create(file, this.caption());
      this.createdId.set(post.id);
      this.success.set(true);
    } catch (error) {
      this.serverError.set(errorMessage(error));
    } finally {
      this.submitting.set(false);
    }
  }

  goToProfile(): void {
    void this.router.navigate(['/u', this.auth.currentUser()?.handle ?? 'alice']);
  }
}
