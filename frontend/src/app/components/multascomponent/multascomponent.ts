import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MultaModel } from '../../models/multa.model';
import { AuthService } from '../../services/auth.service';
import { MultaService } from '../../services/multa.service';

@Component({
  selector: 'app-multascomponent',
  standalone: false,
  styleUrl: './multascomponent.css',
  templateUrl: './multascomponent.html',
})
export class Multascomponent implements OnInit {
  multas: MultaModel[] = [];
  estados: string[] = ['PENDIENTE', 'PAGADA', 'CONDONADA'];
  estado: string = 'PENDIENTE';
  errorEstado: string = '';
  cargando: boolean = true;
  error: string = '';
  mensaje: string = '';
  errorAccion: string = '';
  pagando: number | null = null;
  confirmando: number | null = null;
  puedeCobrar: boolean = false;

  constructor(
    private auth: AuthService,
    private multaService: MultaService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.puedeCobrar = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
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
    this.multaService.getMultas(this.estado).subscribe({
      next: (multas) => {
        this.multas = multas;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.multas = [];
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  total(): number {
    let suma: number = 0;
    for (const multa of this.multas) {
      suma = suma + multa.valor;
    }
    return suma;
  }

  pagar(multa: MultaModel): void {
    this.mensaje = '';
    this.errorAccion = '';
    this.confirmando = null;
    if (!this.puedeCobrar) {
      this.errorAccion = 'Tu rol no puede cobrar multas.';
      return;
    }
    if (multa.estado !== 'PENDIENTE') {
      this.errorAccion = 'Esa multa ya no está pendiente.';
      return;
    }
    this.pagando = multa.idPrestamo;
    this.multaService.pagarMulta(multa.idPrestamo).subscribe({
      next: (resultado) => {
        this.mensaje = multa.socio + ': ' + resultado.mensaje;
        this.pagando = null;
        this.cargar();
      },
      error: (e: unknown) => {
        this.errorAccion = this.auth.mensajeError(e);
        this.pagando = null;
        this.cdr.markForCheck();
      },
    });
  }
}
