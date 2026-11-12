import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SocioDetalleModel } from '../../models/socio-detalle.model';
import { AuthService } from '../../services/auth.service';
import { SocioService } from '../../services/socio.service';

@Component({
  selector: 'app-detallesociocomponent',
  standalone: false,
  styleUrl: './detallesociocomponent.css',
  templateUrl: './detallesociocomponent.html',
})
export class Detallesociocomponent implements OnInit {
  detalle: SocioDetalleModel | null = null;
  idSocio: number | null = null;
  cargando: boolean = true;
  error: string = '';
  estados: string[] = ['ACTIVO', 'SUSPENDIDO', 'RETIRADO'];
  puedeGestionar: boolean = false;
  confirmando: string = '';
  guardando: boolean = false;
  mensaje: string = '';
  errorAccion: string = '';

  constructor(
    private auth: AuthService,
    private socioService: SocioService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const parametro: unknown = this.route.snapshot.paramMap.get('id');
    const errorId = this.validarId(parametro);
    if (errorId !== '') {
      this.error = errorId;
      this.cargando = false;
      return;
    }
    this.puedeGestionar = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    this.idSocio = Number(parametro);
    this.cargar();
  }

  cargar(): void {
    if (this.idSocio === null) {
      return;
    }
    this.socioService.getSocio(this.idSocio).subscribe({
      next: (detalle) => {
        this.detalle = detalle;
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

  validarId(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'Falta el código del socio en la dirección.';
    }
    if (!/^[0-9]+$/.test(valor)) {
      return 'El código del socio debe ser un número entero positivo.';
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      return 'El código del socio debe ser un número entero positivo.';
    }
    return '';
  }

  validarEstado(valor: unknown): string {
    if (typeof valor !== 'string' || this.estados.indexOf(valor) === -1) {
      return 'Ese estado no existe.';
    }
    if (this.detalle !== null && this.detalle.socio.estado === valor) {
      return 'El socio ya está en ese estado.';
    }
    return '';
  }

  puedeRenovarCarne(): boolean {
    if (this.detalle === null || !this.puedeGestionar) {
      return false;
    }
    if (this.detalle.socio.estado === 'RETIRADO' || this.detalle.socio.numeroCarne === null) {
      return false;
    }
    return (
      this.detalle.socio.estadoCarne !== 'ANULADO' && this.detalle.socio.estadoCarne !== 'BLOQUEADO'
    );
  }

  textoConfirmacion(): string {
    if (this.confirmando === 'SUSPENDIDO') {
      return 'Confirmar suspensión';
    }
    if (this.confirmando === 'RETIRADO') {
      return 'Confirmar retiro';
    }
    if (this.confirmando === 'ACTIVO') {
      return 'Confirmar reactivación';
    }
    return 'Confirmar renovación';
  }

  pedir(accion: string): void {
    this.mensaje = '';
    this.errorAccion = '';
    this.confirmando = accion;
  }

  confirmar(): void {
    const accion = this.confirmando;
    this.confirmando = '';
    this.mensaje = '';
    this.errorAccion = '';
    if (!this.puedeGestionar) {
      this.errorAccion = 'Tu rol no puede cambiar el estado de los socios.';
      return;
    }
    if (this.idSocio === null) {
      return;
    }
    if (accion === 'CARNE') {
      this.guardando = true;
      this.socioService.renovarCarne(this.idSocio).subscribe({
        next: (resultado) => this.terminar(resultado.mensaje),
        error: (e: unknown) => this.fallar(e),
      });
      return;
    }
    const errorEstado = this.validarEstado(accion);
    if (errorEstado !== '') {
      this.errorAccion = errorEstado;
      return;
    }
    this.guardando = true;
    this.socioService.cambiarEstado(this.idSocio, accion).subscribe({
      next: (resultado) => this.terminar(resultado.mensaje),
      error: (e: unknown) => this.fallar(e),
    });
  }

  prestamosAbiertos(): number {
    if (this.detalle === null) {
      return 0;
    }
    return this.detalle.socio.prestamosAbiertos;
  }

  private terminar(mensaje: string): void {
    this.guardando = false;
    this.mensaje = mensaje;
    this.cargar();
  }

  private fallar(e: unknown): void {
    this.guardando = false;
    this.errorAccion = this.auth.mensajeError(e);
    this.cdr.markForCheck();
  }
}
