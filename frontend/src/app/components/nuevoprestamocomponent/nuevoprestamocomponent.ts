import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EjemplarConsultaModel } from '../../models/ejemplar-consulta.model';
import { EmpleadoModel } from '../../models/empleado.model';
import { SocioModel } from '../../models/socio.model';
import { AuthService } from '../../services/auth.service';
import { LibroService } from '../../services/libro.service';
import { PrestamoService } from '../../services/prestamo.service';
import { SocioService } from '../../services/socio.service';

@Component({
  selector: 'app-nuevoprestamocomponent',
  standalone: false,
  styleUrl: './nuevoprestamocomponent.css',
  templateUrl: './nuevoprestamocomponent.html',
})
export class Nuevoprestamocomponent implements OnInit {
  empleado: EmpleadoModel | null = null;
  documento: string = '';
  socio: SocioModel | null = null;
  errorDocumento: string = '';
  buscandoSocio: boolean = false;
  codigo: string = '';
  ejemplar: EjemplarConsultaModel | null = null;
  errorCodigo: string = '';
  buscandoEjemplar: boolean = false;
  errorGuardar: string = '';
  guardando: boolean = false;

  constructor(
    private auth: AuthService,
    private socioService: SocioService,
    private libroService: LibroService,
    private prestamoService: PrestamoService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.empleado = this.auth.getEmpleado();
    const documento: unknown = this.route.snapshot.queryParamMap.get('documento');
    if (typeof documento === 'string') {
      this.documento = documento;
      this.buscarSocio();
    }
    const codigo: unknown = this.route.snapshot.queryParamMap.get('codigo');
    if (typeof codigo === 'string') {
      this.codigo = codigo;
      this.buscarEjemplar();
    }
  }

  validarDocumento(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El documento debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe el documento del socio.';
    }
    if (!/^[A-Za-z0-9]+$/.test(valor.trim())) {
      return 'El documento solo admite letras y números, sin espacios ni puntos.';
    }
    if (valor.trim().length > 20) {
      return 'El documento tiene máximo 20 caracteres.';
    }
    return '';
  }

  validarCodigo(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El código debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe o escanea el código de barras.';
    }
    if (!/^[A-Za-z0-9-]+$/.test(valor.trim())) {
      return 'El código solo admite letras, números y guiones.';
    }
    if (valor.trim().length > 20) {
      return 'El código tiene máximo 20 caracteres.';
    }
    return '';
  }

  buscarSocio(): void {
    this.socio = null;
    this.errorDocumento = this.validarDocumento(this.documento);
    if (this.errorDocumento !== '') {
      return;
    }
    this.buscandoSocio = true;
    this.socioService.getPorDocumento(this.documento.trim()).subscribe({
      next: (socio) => {
        this.socio = socio;
        if (socio === null) {
          this.errorDocumento = 'No hay ningún socio con ese documento.';
        }
        this.buscandoSocio = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorDocumento = this.auth.mensajeError(e);
        this.buscandoSocio = false;
        this.cdr.markForCheck();
      },
    });
  }

  buscarEjemplar(): void {
    this.ejemplar = null;
    this.errorCodigo = this.validarCodigo(this.codigo);
    if (this.errorCodigo !== '') {
      return;
    }
    this.buscandoEjemplar = true;
    this.libroService.getEjemplarPorCodigo(this.codigo.trim()).subscribe({
      next: (ejemplar) => {
        this.ejemplar = ejemplar;
        this.buscandoEjemplar = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorCodigo = this.auth.mensajeError(e);
        this.buscandoEjemplar = false;
        this.cdr.markForCheck();
      },
    });
  }

  ejemplarEnOtraSede(): boolean {
    return (
      this.ejemplar !== null &&
      this.empleado !== null &&
      this.ejemplar.idSede !== this.empleado.idSede
    );
  }

  registrar(): void {
    this.errorGuardar = '';
    if (this.socio === null) {
      this.errorDocumento = 'Busca primero al socio.';
    }
    if (this.ejemplar === null) {
      this.errorCodigo = 'Busca primero el ejemplar.';
    }
    if (this.socio === null || this.ejemplar === null) {
      return;
    }
    this.guardando = true;
    this.prestamoService.registrarPrestamo(this.socio.idSocio, this.ejemplar.idEjemplar).subscribe({
      next: (resultado) => {
        this.router.navigate(['/prestamos'], { state: { mensaje: resultado.mensaje } });
      },
      error: (e: unknown) => {
        this.errorGuardar = this.auth.mensajeError(e);
        this.guardando = false;
        this.cdr.markForCheck();
      },
    });
  }
}
