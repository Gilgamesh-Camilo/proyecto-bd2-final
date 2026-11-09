import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { EmpleadoModel } from '../../models/empleado.model';
import { TrasladoModel } from '../../models/traslado.model';
import { AuthService } from '../../services/auth.service';
import { DatosService } from '../../services/datos.service';
import { TrasladoService } from '../../services/traslado.service';

@Component({
  selector: 'app-trasladoscomponent',
  standalone: false,
  styleUrl: './trasladoscomponent.css',
  templateUrl: './trasladoscomponent.html',
})
export class Trasladoscomponent implements OnInit {
  traslados: TrasladoModel[] = [];
  estados: string[] = ['SOLICITADO', 'EN_TRANSITO', 'RECIBIDO', 'CANCELADO'];
  estado: string = '';
  errorEstado: string = '';
  empleado: EmpleadoModel | null = null;
  puedeGestionar: boolean = false;
  cargando: boolean = true;
  error: string = '';
  mensaje: string = '';
  errorAccion: string = '';
  avanzando: number | null = null;

  constructor(
    private auth: AuthService,
    private trasladoService: TrasladoService,
    private datos: DatosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.mensaje = this.datos.mensajeNavegacion();
    this.empleado = this.auth.getEmpleado();
    this.puedeGestionar = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    this.cargar();
  }

  validarEstado(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'Elige un estado de la lista.';
    }
    if (valor !== '' && this.estados.indexOf(valor) === -1) {
      return 'Elige un estado de la lista.';
    }
    return '';
  }

  cargar(): void {
    this.errorEstado = this.validarEstado(this.estado);
    if (this.errorEstado !== '') {
      return;
    }
    this.cargando = true;
    this.error = '';
    this.trasladoService.getTraslados(this.estado).subscribe({
      next: (traslados) => {
        this.traslados = traslados;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.traslados = [];
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  accion(traslado: TrasladoModel): string {
    if (!this.puedeGestionar || this.empleado === null) {
      return '';
    }
    if (traslado.estado === 'SOLICITADO' && traslado.idSedeOrigen === this.empleado.idSede) {
      return 'Despachar';
    }
    if (traslado.estado === 'EN_TRANSITO' && traslado.idSedeDestino === this.empleado.idSede) {
      return 'Recibir';
    }
    return '';
  }

  avanzar(traslado: TrasladoModel): void {
    this.mensaje = '';
    this.errorAccion = '';
    if (this.accion(traslado) === '') {
      this.errorAccion = 'Este traslado no lo puede avanzar tu sede.';
      return;
    }
    this.avanzando = traslado.idTraslado;
    this.trasladoService.avanzarTraslado(traslado.idTraslado).subscribe({
      next: (resultado) => {
        this.mensaje = 'Traslado ' + traslado.idTraslado + ': ' + resultado.mensaje;
        this.avanzando = null;
        this.cargar();
      },
      error: (e: unknown) => {
        this.errorAccion = 'Traslado ' + traslado.idTraslado + ': ' + this.auth.mensajeError(e);
        this.avanzando = null;
        this.cdr.markForCheck();
      },
    });
  }
}
