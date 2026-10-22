import { Component, computed, effect, input, OnDestroy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AnnotationAudio } from '../../domain/entities';

/** Só um áudio toca por vez: dar play em outro pausa o anterior. */
let playingNow: HTMLAudioElement | null = null;

const RATES = [1, 1.5, 2];

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Player compacto de nota de voz, no estilo de mensagem de áudio. */
@Component({
  selector: 'app-audio-player',
  imports: [MatButtonModule, MatIconModule],
  // Fica dentro de itens clicáveis (painel de anotações): os cliques no player não devem abrir o item.
  host: { '(click)': '$event.stopPropagation()', '(keydown)': '$event.stopPropagation()' },
  template: `
    <button mat-icon-button type="button" class="play" (click)="toggle()" [attr.aria-label]="playing() ? 'Pausar' : 'Ouvir nota de voz'">
      <mat-icon>{{ playing() ? 'pause' : 'play_arrow' }}</mat-icon>
    </button>
    <input type="range" class="track" min="0" [max]="duration()" step="10" [value]="position()" [style.--progress]="progress()"
           (input)="seek(+$any($event.target).value)" aria-label="Posição do áudio" />
    <span class="time">{{ label() }}</span>
    <button type="button" class="rate" (click)="cycleRate()" aria-label="Velocidade de reprodução">{{ rate() }}×</button>
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 8px; padding: 2px 10px 2px 2px; border-radius: 999px; min-width: 0;
      background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
    .play { flex: none; background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); width: 36px; height: 36px; padding: 6px; }
    .track { flex: 1; min-width: 60px; height: 4px; margin: 0; appearance: none; border-radius: 2px; cursor: pointer; background:
      linear-gradient(90deg, var(--mat-sys-primary) calc(var(--progress) * 100%), color-mix(in srgb, currentColor 25%, transparent) 0); }
    .track::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; border-radius: 50%; background: var(--mat-sys-primary); }
    .track::-moz-range-thumb { width: 12px; height: 12px; border: none; border-radius: 50%; background: var(--mat-sys-primary); }
    .time { flex: none; font: var(--mat-sys-label-small); font-variant-numeric: tabular-nums; }
    .rate { flex: none; border: none; border-radius: 999px; padding: 2px 6px; cursor: pointer; font: var(--mat-sys-label-small);
      background: color-mix(in srgb, currentColor 12%, transparent); color: inherit; }
  `,
})
export class AudioPlayerComponent implements OnDestroy {
  readonly audio = input.required<AnnotationAudio>();

  protected readonly playing = signal(false);
  protected readonly position = signal(0);
  protected readonly rate = signal(1);
  protected readonly duration = computed(() => Math.max(this.audio().durationMs, 1));
  protected readonly progress = computed(() => Math.min(this.position() / this.duration(), 1));
  protected readonly label = computed(() => formatDuration(this.playing() || this.position() ? this.position() : this.duration()));

  private element: HTMLAudioElement | null = null;
  private url: string | null = null;

  constructor() {
    // Trocou o áudio (ex.: regravação) → descarta o elemento antigo.
    effect(() => {
      this.audio();
      this.dispose();
    });
  }

  protected toggle(): void {
    const el = this.ensureElement();
    if (el.paused) {
      if (playingNow && playingNow !== el) playingNow.pause();
      playingNow = el;
      void el.play();
    } else {
      el.pause();
    }
  }

  protected seek(ms: number): void {
    this.ensureElement().currentTime = ms / 1000;
    this.position.set(ms);
  }

  protected cycleRate(): void {
    const next = RATES[(RATES.indexOf(this.rate()) + 1) % RATES.length];
    this.rate.set(next);
    if (this.element) this.element.playbackRate = next;
  }

  private ensureElement(): HTMLAudioElement {
    if (this.element) return this.element;
    this.url = URL.createObjectURL(this.audio().blob);
    const el = new Audio(this.url);
    el.playbackRate = this.rate();
    el.onplay = () => this.playing.set(true);
    el.onpause = () => this.playing.set(false);
    el.ontimeupdate = () => this.position.set(el.currentTime * 1000);
    el.onended = () => {
      this.playing.set(false);
      this.position.set(0);
    };
    this.element = el;
    return el;
  }

  private dispose(): void {
    if (this.element) {
      this.element.pause();
      if (playingNow === this.element) playingNow = null;
      this.element = null;
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.playing.set(false);
    this.position.set(0);
  }

  ngOnDestroy(): void {
    this.dispose();
  }
}
