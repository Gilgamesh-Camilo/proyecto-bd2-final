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

  constructor(
    private auth: AuthService,
    private prestamoService: PrestamoService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.empleado = this.auth.getEmpleado();
    const parametro: unknown = this.route.snapshot.paramMap.get('id');
    const errorId = this.validarId(parametro);
    if (errorId !== '') {
      this.error = errorId;
      this.cargando = false;
      return;
    }
    this.idPrestamo = Number(parametro);
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
}
