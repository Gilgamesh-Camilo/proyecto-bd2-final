import { Component, Input } from '@angular/core';
import { DisponibilidadSedeModel } from '../../models/disponibilidad-sede.model';
import { LibroModel } from '../../models/libro.model';

@Component({
  selector: 'app-tarjetalibrocomponent',
  standalone: false,
  styleUrl: './tarjetalibrocomponent.css',
  templateUrl: './tarjetalibrocomponent.html',
})
export class Tarjetalibrocomponent {
  @Input() libro: LibroModel | null = null;

  estadoSede(disponibilidad: DisponibilidadSedeModel): string {
    if (disponibilidad.total === 0) {
      return 'sin';
    }
    if (disponibilidad.disponibles === 0) {
      return 'agotado';
    }
    return 'libre';
  }
}
