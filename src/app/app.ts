import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Armazón de la aplicación.
 *
 * Deliberadamente vacío: no importa ningún componente de PrimeNG ni aporta
 * interfaz propia, porque todo lo que entra acá viaja en el chunk inicial. Cada
 * feature trae su layout y sus componentes desde la ruta que la carga de forma
 * diferida.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
