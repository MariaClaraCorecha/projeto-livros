import { Component, computed, input } from '@angular/core';

/** Capa do livro; sem imagem, gera uma capa tipográfica com cor derivada do título. */
@Component({
  selector: 'app-book-cover',
  template: `
    @if (cover()) {
      <img [src]="cover()" [alt]="'Capa de ' + title()" loading="lazy" draggable="false" />
    } @else {
      <div class="generated" [style.background]="gradient()">
        <span class="title">{{ title() }}</span>
        @if (author()) {
          <span class="author">{{ author() }}</span>
        }
      </div>
    }
  `,
  styles: `
    :host { display: block; aspect-ratio: 2 / 3; border-radius: 3px 6px 6px 3px; overflow: hidden; position: relative;
      box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 6px 14px rgba(0,0,0,.18); background: var(--mat-sys-surface-container-high); }
    :host::after { content: ''; position: absolute; inset: 0 auto 0 0; width: 8%;
      background: linear-gradient(90deg, rgba(0,0,0,.25), rgba(255,255,255,.12) 60%, transparent); pointer-events: none; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .generated { height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 14% 12% 12% 16%;
      box-sizing: border-box; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.3); }
    .title { font-family: var(--display-font); font-size: clamp(11px, 1.1em, 18px); line-height: 1.15; font-weight: 600;
      display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
    .author { font-size: .72em; opacity: .9; text-transform: uppercase; letter-spacing: .06em;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  `,
})
export class BookCoverComponent {
  readonly title = input.required<string>();
  readonly author = input('');
  readonly cover = input<string | null>(null);

  protected readonly gradient = computed(() => {
    let hash = 0;
    for (const ch of this.title()) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const hue = Math.abs(hash) % 360;
    return `linear-gradient(160deg, hsl(${hue} 45% 42%), hsl(${(hue + 40) % 360} 50% 26%))`;
  });
}
