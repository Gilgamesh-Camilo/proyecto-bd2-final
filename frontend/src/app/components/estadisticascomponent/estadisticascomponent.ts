import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ConteoModel } from '../../models/conteo.model';
import { EstadisticasModel } from '../../models/estadisticas.model';
import { AuthService } from '../../services/auth.service';
import { EstadisticaService } from '../../services/estadistica.service';

@Component({
  selector: 'app-estadisticascomponent',
  standalone: false,
  styleUrl: './estadisticascomponent.css',
  templateUrl: './estadisticascomponent.html',
})
export class Estadisticascomponent implements OnInit {
  estadisticas: EstadisticasModel | null = null;
  cargando: boolean = true;
  error: string = '';

  constructor(
    private auth: AuthService,
    private estadisticaService: EstadisticaService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.estadisticaService.getEstadisticas().subscribe({
      next: (estadisticas) => {
        this.estadisticas = estadisticas;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  ancho(lista: ConteoModel[], valor: number): number {
    let maximo: number = 0;
    for (const fila of lista) {
      if (fila.valor > maximo) {
        maximo = fila.valor;
      }
    }
    if (maximo <= 0) {
      return 0;
    }
    return Math.round((valor * 100) / maximo);
  }
}
