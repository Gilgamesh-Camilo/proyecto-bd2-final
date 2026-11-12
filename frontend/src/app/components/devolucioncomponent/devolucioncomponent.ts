import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EmpleadoModel } from '../../models/empleado.model';
import { PrestamoDetalleModel } from '../../models/prestamo-detalle.model';
import { AuthService } from '../../services/auth.service';
import { PrestamoService } from '../../services/prestamo.service';

@Component({
  selector: 'app-devolucioncomponent',
  standalone: false,
  styleUrl: './devolucioncomponent.css',
  templateUrl: './devolucioncomponent.html',
})
export class Devolucioncomponent implements OnInit {
  idPrestamo: number | null = null;
  detalle: PrestamoDetalleModel | null = null;
  empleado: EmpleadoModel | null = null;
  cargando: boolean = true;
  error: string = '';
  errorGuardar: string = '';
  guardando: boolean = false;

  puedeMultar: boolean = false;
  valorPerdida: number | null = null;
  valorDano: number | null = null;
  errorValorPerdida: string = '';
  errorValorDano: string = '';
  errorMulta: string = '';
  mensajeMulta: string = '';
  confirmandoPerdida: boolean = false;
  guardandoMulta: boolean = false;

  constructor(
    private auth: AuthService,
    private prestamoService: PrestamoService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.empleado = this.auth.getEmpleado();
    this.puedeMultar = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    const parametro: unknown = this.route.snapshot.paramMap.get('id');
    const errorId = this.validarId(parametro);
    if (errorId !== '') {
      this.error = errorId;
      this.cargando = false;
      return;
    }
    this.idPrestamo = Number(parametro);
    this.cargar();
  }

  cargar(): void {
    if (this.idPrestamo === null) {
      return;
    }
    this.prestamoService.getPrestamo(this.idPrestamo).subscribe({
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
      return 'Falta el número del préstamo en la dirección.';
    }
    if (!/^[0-9]+$/.test(valor)) {
      return 'El número del préstamo debe ser un entero positivo.';
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      return 'El número del préstamo debe ser un entero positivo.';
    }
    return '';
  }

  estaAbierto(): boolean {
    if (this.detalle === null) {
      return false;
    }
    return this.detalle.prestamo.estado === 'ACTIVO' || this.detalle.prestamo.estado === 'VENCIDO';
  }

  puedeRegistrarDano(): boolean {
    if (this.detalle === null || this.detalle.prestamo.estado !== 'DEVUELTO') {
      return false;
    }
    return this.detalle.multaEstado === null || this.detalle.multaEstado === 'PENDIENTE';
  }

  validarValorPerdida(valor: unknown): string {
    if (valor === null) {
      return '';
    }
    return this.validarValor(valor);
  }

  validarValorDano(valor: unknown): string {
    if (valor === null) {
      return 'Escribe el valor de la multa por daño.';
    }
    return this.validarValor(valor);
  }

  pedirPerdida(): void {
    this.errorMulta = '';
    this.mensajeMulta = '';
    this.errorValorPerdida = this.validarValorPerdida(this.valorPerdida);
    if (this.errorValorPerdida !== '') {
      return;
    }
    this.confirmandoPerdida = true;
  }

  registrarPerdida(): void {
    this.confirmandoPerdida = false;
    this.errorValorPerdida = this.validarValorPerdida(this.valorPerdida);
    if (this.errorValorPerdida !== '') {
      return;
    }
    this.enviarMulta('PERDIDA', this.valorPerdida);
  }

  registrarDano(): void {
    this.errorValorDano = this.validarValorDano(this.valorDano);
    if (this.errorValorDano !== '') {
      return;
    }
    this.enviarMulta('DANO', this.valorDano);
  }

  registrar(): void {
    this.errorGuardar = '';
    if (this.idPrestamo === null || !this.estaAbierto()) {
      this.errorGuardar = 'Este préstamo ya está cerrado.';
      return;
    }
    this.guardando = true;
    this.prestamoService.registrarDevolucion(this.idPrestamo).subscribe({
      next: (resultado) => {
        this.router.navigate(['/prestamos'], {
          state: { mensaje: 'Préstamo ' + this.idPrestamo + ': ' + resultado.mensaje },
        });
      },
      error: (e: unknown) => {
        this.errorGuardar = this.auth.mensajeError(e);
        this.guardando = false;
        this.cdr.markForCheck();
      },
    });
  }

  private validarValor(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      return 'El valor debe ser un número.';
    }
    if (valor <= 0 || valor > 9999999999) {
      return 'El valor debe ser mayor que cero y máximo 9999999999.';
    }
    if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(String(valor))) {
      return 'El valor admite máximo dos decimales.';
    }
    return '';
  }

  private enviarMulta(motivo: string, valor: number | null): void {
    this.errorMulta = '';
    this.mensajeMulta = '';
    if (!this.puedeMultar) {
      this.errorMulta = 'Tu rol no puede registrar multas.';
      return;
    }
    if (this.idPrestamo === null) {
      return;
    }
    this.guardandoMulta = true;
    this.prestamoService.registrarMulta(this.idPrestamo, motivo, valor).subscribe({
      next: (resultado) => {
        this.guardandoMulta = false;
        this.valorPerdida = null;
        this.valorDano = null;
        this.mensajeMulta = resultado.mensaje;
        this.cargar();
      },
      error: (e: unknown) => {
        this.guardandoMulta = false;
        this.errorMulta = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
  }
}
