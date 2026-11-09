import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ReservaModel } from '../../models/reserva.model';
import { AuthService } from '../../services/auth.service';
import { DatosService } from '../../services/datos.service';
import { ReservaService } from '../../services/reserva.service';

@Component({
  selector: 'app-reservascomponent',
  standalone: false,
  styleUrl: './reservascomponent.css',
  templateUrl: './reservascomponent.html',
})
export class Reservascomponent implements OnInit {
  reservas: ReservaModel[] = [];
  estados: string[] = ['EN_ESPERA', 'DISPONIBLE', 'ATENDIDA', 'CANCELADA', 'EXPIRADA'];
  estado: string = '';
  errorEstado: string = '';
  cargando: boolean = true;
  error: string = '';
  mensaje: string = '';
  errorAccion: string = '';
  cancelando: number | null = null;
  confirmando: number | null = null;

  constructor(
    private auth: AuthService,
    private reservaService: ReservaService,
    private datos: DatosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.mensaje = this.datos.mensajeNavegacion();
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
    this.reservaService.getReservas(this.estado).subscribe({
      next: (reservas) => {
        this.reservas = reservas;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.reservas = [];
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  estaAbierta(reserva: ReservaModel): boolean {
    return reserva.estado === 'EN_ESPERA' || reserva.estado === 'DISPONIBLE';
  }

  cancelar(reserva: ReservaModel): void {
    this.mensaje = '';
    this.errorAccion = '';
    this.confirmando = null;
    if (!this.estaAbierta(reserva)) {
      this.errorAccion = 'Esa reserva ya está cerrada.';
      return;
    }
    this.cancelando = reserva.idReserva;
    this.reservaService.cancelarReserva(reserva.idReserva).subscribe({
      next: (resultado) => {
        this.mensaje = 'Reserva ' + reserva.idReserva + ': ' + resultado.mensaje;
        this.cancelando = null;
        this.cargar();
      },
      error: (e: unknown) => {
        this.errorAccion = 'Reserva ' + reserva.idReserva + ': ' + this.auth.mensajeError(e);
        this.cancelando = null;
        this.cdr.markForCheck();
      },
    });
  }
}
