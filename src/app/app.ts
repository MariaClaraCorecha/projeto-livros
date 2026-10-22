import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PreferencesStore } from './presentation/state/preferences.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Instanciado cedo para aplicar tema e fontes assim que o usuário entra.
  protected readonly preferences = inject(PreferencesStore);
}
