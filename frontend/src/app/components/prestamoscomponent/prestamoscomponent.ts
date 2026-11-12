import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PanelModel } from '../../models/panel.model';
import { PrestamoModel } from '../../models/prestamo.model';
import { SedeModel } from '../../models/sede.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { DatosService } from '../../services/datos.service';
import { PrestamoService } from '../../services/prestamo.service';

@Component({
  selector: 'app-prestamoscomponent',
  standalone: false,
  styleUrl: './prestamoscomponent.css',
  templateUrl: './prestamoscomponent.html',
})
export class Prestamoscomponent implements OnInit {
  prestamos: PrestamoModel[] = [];
  abiertos: PrestamoModel[] = [];
  sedes: SedeModel[] = [];
  panel: PanelModel | null = null;
  estados: string[] = ['ACTIVO', 'VENCIDO', 'DEVUELTO', 'PERDIDO'];
  estado: string = '';
  idSede: number | null = null;
  busqueda: string = '';
  busquedaAplicada: string = '';
  documentoPrestamo: string = '';
  codigoPrestamo: string = '';
  errorEstado: string = '';
  errorSede: string = '';
  errorBusqueda: string = '';
  errorDocumento: string = '';
  errorCodigo: string = '';
  cargando: boolean = true;
  error: string = '';
  errorPanel: string = '';
  mensaje: string = '';
  errorAccion: string = '';
  renovando: number | null = null;
  puedeMultar: boolean = false;

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private prestamoService: PrestamoService,
    private datos: DatosService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.mensaje = this.datos.mensajeNavegacion();
    this.puedeMultar = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    this.catalogoService.getCatalogos().subscribe({
      next: (catalogos) => {
        this.sedes = catalogos.sedes;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
    this.cargarPanel();
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

  validarSede(valor: unknown): string {
    if (valor === null) {
      return '';
    }
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige una sede de la lista.';
    }
    for (const sede of this.sedes) {
      if (sede.idSede === valor) {
        return '';
      }
    }
    return 'Elige una sede de la lista.';
  }

  validarBusqueda(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La búsqueda debe ser texto.';
    }
    if (valor.trim() === '') {
      return '';
    }
    if (!/^[A-Za-z0-9-]+$/.test(valor.trim())) {
      return 'Escribe un código de barras o un documento, sin espacios ni puntos.';
    }
    if (valor.trim().length > 20) {
      return 'La búsqueda tiene máximo 20 caracteres.';
    }
    return '';
  }

  validarDocumento(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El documento debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe el documento del socio.';
    }
    if (!/^[A-Za-z0-9]+$/.test(valor.trim())) {
      return 'Sin puntos ni espacios.';
    }
    if (valor.trim().length > 20) {
      return 'Máximo 20 caracteres.';
    }
    return '';
  }

  validarCodigo(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El código debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe o escanea el código.';
    }
    if (!/^[A-Za-z0-9-]+$/.test(valor.trim())) {
      return 'Solo letras, números y guiones.';
    }
    if (valor.trim().length > 20) {
      return 'Máximo 20 caracteres.';
    }
    return '';
  }

  cargarPanel(): void {
    this.catalogoService.getPanel().subscribe({
      next: (panel) => {
        this.panel = panel;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorPanel = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
  }

  buscar(): void {
    this.errorBusqueda = this.validarBusqueda(this.busqueda);
    if (this.errorBusqueda !== '') {
      return;
    }
    this.busquedaAplicada = this.busqueda.trim();
    this.cargar();
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    this.errorBusqueda = '';
    this.busquedaAplicada = '';
    this.cargar();
  }

  cargar(): void {
    this.errorEstado = this.validarEstado(this.estado);
    this.errorSede = this.validarSede(this.idSede);
    if (this.errorEstado !== '' || this.errorSede !== '') {
      return;
    }
    this.cargando = true;
    this.error = '';
    this.prestamoService.getPrestamos(this.estado, this.idSede, this.busquedaAplicada).subscribe({
      next: (prestamos) => {
        this.prestamos = prestamos;
        this.abiertos = [];
        if (this.busquedaAplicada !== '') {
          for (const prestamo of prestamos) {
            if (this.estaAbierto(prestamo)) {
              this.abiertos.push(prestamo);
            }
          }
        }
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.prestamos = [];
        this.abiertos = [];
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  estaAbierto(prestamo: PrestamoModel): boolean {
    return prestamo.estado === 'ACTIVO' || prestamo.estado === 'VENCIDO';
  }

  renovar(prestamo: PrestamoModel): void {
    this.mensaje = '';
    this.errorAccion = '';
    if (prestamo.estado !== 'ACTIVO') {
      this.errorAccion = 'Solo se renueva un préstamo activo.';
      return;
    }
    this.renovando = prestamo.idPrestamo;
    this.prestamoService.renovarPrestamo(prestamo.idPrestamo).subscribe({
      next: (resultado) => {
        this.mensaje = 'Préstamo ' + prestamo.idPrestamo + ': ' + resultado.mensaje;
        this.renovando = null;
        this.cargar();
      },
      error: (e: unknown) => {
        this.errorAccion = 'Préstamo ' + prestamo.idPrestamo + ': ' + this.auth.mensajeError(e);
        this.renovando = null;
        this.cdr.markForCheck();
      },
    });
  }

  continuarPrestamo(): void {
    this.errorDocumento = this.validarDocumento(this.documentoPrestamo);
    this.errorCodigo = this.validarCodigo(this.codigoPrestamo);
    if (this.errorDocumento !== '' || this.errorCodigo !== '') {
      return;
    }
    this.router
      .navigate(['/prestamos/nuevo'], {
        queryParams: {
          documento: this.documentoPrestamo.trim(),
          codigo: this.codigoPrestamo.trim(),
        },
      })
      .catch(() => {
        this.errorCodigo = 'No se pudo abrir el formulario del préstamo.';
        this.cdr.markForCheck();
      });
  }
}
