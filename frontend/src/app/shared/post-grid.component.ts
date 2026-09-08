import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PostSummary } from '../core/models';

@Component({
  selector: 'app-post-grid',
  imports: [RouterLink],
  templateUrl: './post-grid.component.html',
  styleUrl: './post-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostGridComponent {
  readonly posts = input<PostSummary[]>([]);
  readonly showAuthor = input<boolean>(true);
  readonly testid = input<string>('post-grid');
}
