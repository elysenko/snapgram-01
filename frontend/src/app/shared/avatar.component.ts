import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const AVATAR_COLORS = ['#7c3aed', '#ec4899', '#0ea5e9', '#f97316', '#10b981', '#6366f1', '#f43f5e', '#0891b2'];

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input<string>('');
  readonly handle = input<string>('');
  readonly imageUrl = input<string | null>(null);
  /** Diameter in pixels. */
  readonly size = input<number>(40);
  readonly ring = input<boolean>(false);

  readonly initials = computed(() => {
    const source = this.name().trim() || this.handle().trim();
    if (!source) {
      return '?';
    }
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  readonly background = computed(() => {
    const key = this.handle() || this.name();
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) % 9973;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  });

  readonly fontSize = computed(() => Math.max(11, Math.round(this.size() * 0.38)));
}
