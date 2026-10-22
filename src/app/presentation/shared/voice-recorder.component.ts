import { afterNextRender, Component, computed, input, model, OnDestroy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AnnotationAudio } from '../../domain/entities';
import { AudioPlayerComponent, formatDuration } from './audio-player.component';

/** Limite de uma nota de voz; ao atingir, a gravação para sozinha. */
const MAX_DURATION_MS = 5 * 60_000;
const BARS = 24;
const silence = () => Array<number>(BARS).fill(0.1);

/** Grava uma nota de voz pelo microfone e permite ouvir, regravar ou remover. */
@Component({
  selector: 'app-voice-recorder',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, AudioPlayerComponent],
  template: `
    @if (recording()) {
      <div class="recording" role="status">
        <span class="dot"></span>
        <span class="time">{{ elapsedLabel() }}</span>
        <div class="bars" aria-hidden="true">
          @for (level of levels(); track $index) {
            <span [style.transform]="'scaleY(' + level + ')'"></span>
          }
        </div>
        <button mat-icon-button type="button" (click)="cancel()" matTooltip="Descartar" aria-label="Descartar gravação">
          <mat-icon>delete</mat-icon>
        </button>
        <button mat-flat-button type="button" class="stop" (click)="stop()"><mat-icon>stop</mat-icon> Parar</button>
      </div>
    } @else if (audio(); as a) {
      <div class="saved">
        <app-audio-player [audio]="a" />
        <button mat-icon-button type="button" (click)="start()" matTooltip="Regravar" aria-label="Regravar"><mat-icon>replay</mat-icon></button>
        <button mat-icon-button type="button" (click)="audio.set(null)" matTooltip="Remover nota de voz" aria-label="Remover nota de voz">
          <mat-icon>delete</mat-icon>
        </button>
      </div>
    } @else {
      <button mat-stroked-button type="button" (click)="start()" [disabled]="!supported"><mat-icon>mic</mat-icon> Gravar nota de voz</button>
    }
    @if (error(); as e) {
      <p class="error" role="alert"><mat-icon>mic_off</mat-icon>{{ e }}</p>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 6px; }
    .recording, .saved { display: flex; align-items: center; gap: 8px; }
    .saved app-audio-player { flex: 1; }
    .recording { padding: 4px 4px 4px 14px; border-radius: 999px; background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container); }
    .dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--mat-sys-error); animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .3; transform: scale(.8); } }
    .time { font: var(--mat-sys-label-large); font-variant-numeric: tabular-nums; min-width: 38px; }
    .bars { flex: 1; display: flex; align-items: center; gap: 2px; height: 28px; overflow: hidden; }
    .bars span { flex: 1; max-width: 4px; height: 100%; border-radius: 2px; background: currentColor; opacity: .7;
      transform-origin: center; transition: transform .08s linear; }
    .stop { background: var(--mat-sys-error); color: var(--mat-sys-on-error); }
    .error { display: flex; align-items: center; gap: 6px; margin: 0; font: var(--mat-sys-body-small); color: var(--mat-sys-error); }
    .error mat-icon { font-size: 18px; width: 18px; height: 18px; }
    @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
  `,
})
export class VoiceRecorderComponent implements OnDestroy {
  readonly audio = model<AnnotationAudio | null>(null);
  /** Começa a gravar assim que o componente aparece. */
  readonly autoStart = input(false);

  protected readonly supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  readonly recording = signal(false);
  protected readonly elapsed = signal(0);
  protected readonly levels = signal(silence());
  protected readonly error = signal<string | null>(null);
  protected readonly elapsedLabel = computed(() => formatDuration(this.elapsed()));

  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private frame = 0;
  private startedAt = 0;
  private discard = false;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      if (this.autoStart() && !this.audio()) void this.start();
    });
  }

  protected async start(): Promise<void> {
    if (!this.supported) {
      this.error.set('Este navegador não permite gravar áudio.');
      return;
    }
    this.error.set(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      this.error.set(
        (e as DOMException).name === 'NotAllowedError'
          ? 'Permita o acesso ao microfone para gravar.'
          : 'Não foi possível acessar o microfone.',
      );
      return;
    }
    // O diálogo pode ter fechado enquanto o navegador pedia permissão.
    if (this.destroyed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;

    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    this.discard = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - this.startedAt;
      this.release();
      if (!this.discard && chunks.length) this.audio.set({ blob: new Blob(chunks, { type: recorder.mimeType }), durationMs });
    };
    this.recorder = recorder;
    this.startedAt = Date.now();
    this.elapsed.set(0);
    recorder.start(250);
    this.recording.set(true);
    this.watchLevels(stream);
  }

  protected stop(): void {
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }

  protected cancel(): void {
    this.discard = true;
    this.stop();
  }

  /** Atualiza o cronômetro e as barras de volume a cada quadro, enquanto grava. */
  private watchLevels(stream: MediaStream): void {
    this.audioContext = new AudioContext();
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 512;
    this.audioContext.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let lastPush = 0;

    const tick = (now: number) => {
      const elapsed = Date.now() - this.startedAt;
      this.elapsed.set(elapsed);
      if (elapsed >= MAX_DURATION_MS) return this.stop();
      if (now - lastPush > 70) {
        lastPush = now;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += ((s - 128) / 128) ** 2;
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
        this.levels.update((list) => [...list.slice(1), Math.max(0.1, level)]);
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private release(): void {
    cancelAnimationFrame(this.frame);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.audioContext?.close();
    this.stream = null;
    this.audioContext = null;
    this.recorder = null;
    this.recording.set(false);
    this.levels.set(silence());
  }

  ngOnDestroy(): void {
    // Diálogo fechado no meio da gravação: descarta e libera o microfone.
    this.destroyed = true;
    this.discard = true;
    if (this.recorder?.state === 'recording') this.recorder.stop();
    else this.release();
  }
}
