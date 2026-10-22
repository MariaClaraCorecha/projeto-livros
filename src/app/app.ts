import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreferencesStore } from './presentation/state/preferences.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  protected readonly preferences = inject(PreferencesStore);
}
