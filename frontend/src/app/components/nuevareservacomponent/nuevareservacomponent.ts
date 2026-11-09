import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LibroModel } from '../../models/libro.model';
import { SedeModel } from '../../models/sede.model';
import { SocioModel } from '../../models/socio.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { LibroService } from '../../services/libro.service';
import { ReservaService } from '../../services/reserva.service';
import { SocioService } from '../../services/socio.service';

@Component({
  selector: 'app-nuevareservacomponent',
  standalone: false,
  styleUrl: './nuevareservacomponent.css',
  templateUrl: './nuevareservacomponent.html',
})
export class Nuevareservacomponent implements OnInit {
  libros: LibroModel[] = [];
  sedes: SedeModel[] = [];
  documento: string = '';
  socio: SocioModel | null = null;
  idLibro: number | null = null;
  idSede: number | null = null;
  errorDocumento: string = '';
  errorLibro: string = '';
  errorSede: string = '';
  errorCarga: string = '';
  errorGuardar: string = '';
  buscandoSocio: boolean = false;
  guardando: boolean = false;

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private libroService: LibroService,
    private socioService: SocioService,
    private reservaService: ReservaService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const empleado = this.auth.getEmpleado();
    if (empleado !== null) {
      this.idSede = empleado.idSede;
    }
    const libro: unknown = this.route.snapshot.queryParamMap.get('libro');
    if (libro !== null) {
      this.errorLibro = this.validarLibroParametro(libro);
      if (this.errorLibro === '') {
        this.idLibro = Number(libro);
      }
    }
    const documento: unknown = this.route.snapshot.queryParamMap.get('documento');
    if (typeof documento === 'string') {
      this.documento = documento;
      this.buscarSocio();
    }
    this.catalogoService.getCatalogos().subscribe({
      next: (catalogos) => {
        this.sedes = [];
        for (const sede of catalogos.sedes) {
          if (sede.estado === 'ACTIVA') {
            this.sedes.push(sede);
          }
        }
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorCarga = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
    this.libroService.getLibros('', null, null).subscribe({
      next: (libros) => {
        this.libros = libros;
        if (this.idLibro !== null && this.validarLibro(this.idLibro) !== '') {
          this.errorLibro = 'El libro de la dirección no existe; elige uno de la lista.';
          this.idLibro = null;
        }
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorCarga = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
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

  validarLibroParametro(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El libro de la dirección no es válido; elige uno de la lista.';
    }
    if (!/^[0-9]+$/.test(valor)) {
      return 'El libro de la dirección no es válido; elige uno de la lista.';
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      return 'El libro de la dirección no es válido; elige uno de la lista.';
    }
    return '';
  }

  validarLibro(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige el libro.';
    }
    for (const libro of this.libros) {
      if (libro.idLibro === valor) {
        return '';
      }
    }
    return 'Elige un libro de la lista.';
  }

  validarSede(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige la sede donde lo va a recoger.';
    }
    for (const sede of this.sedes) {
      if (sede.idSede === valor) {
        return '';
      }
    }
    return 'Elige una sede abierta de la lista.';
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

  libroSeleccionado(): LibroModel | null {
    for (const libro of this.libros) {
      if (libro.idLibro === this.idLibro) {
        return libro;
      }
    }
    return null;
  }

  registrar(): void {
    this.errorGuardar = '';
    this.errorLibro = this.validarLibro(this.idLibro);
    this.errorSede = this.validarSede(this.idSede);
    if (this.socio === null) {
      this.errorDocumento = 'Busca primero al socio.';
    }
    if (
      this.socio === null ||
      this.errorLibro !== '' ||
      this.errorSede !== '' ||
      this.idLibro === null ||
      this.idSede === null
    ) {
      return;
    }
    this.guardando = true;
    this.reservaService.crearReserva(this.socio.idSocio, this.idLibro, this.idSede).subscribe({
      next: (resultado) => {
        this.router.navigate(['/reservas'], { state: { mensaje: resultado.mensaje } });
      },
      error: (e: unknown) => {
        this.errorGuardar = this.auth.mensajeError(e);
        this.guardando = false;
        this.cdr.markForCheck();
      },
    });
  }
}
