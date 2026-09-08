import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-follow-button',
  templateUrl: './follow-button.component.html',
  styleUrl: './follow-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowButtonComponent {
  readonly following = input<boolean>(false);
  readonly handle = input<string>('');
  readonly compact = input<boolean>(false);

  readonly toggled = output<boolean>();
}
