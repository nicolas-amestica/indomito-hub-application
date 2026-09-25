import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';

/**
 * Armazón de la aplicación.
 *
 * Aloja la infraestructura visual transversal y el contenido de la ruta activa.
 * El Toast vive aquí para que cualquier servicio o interceptor pueda notificar
 * sin depender de que una feature monte su propio contenedor.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
