import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EjemplarConsultaModel } from '../../models/ejemplar-consulta.model';
import { SedeModel } from '../../models/sede.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { LibroService } from '../../services/libro.service';
import { TrasladoService } from '../../services/traslado.service';

@Component({
  selector: 'app-nuevotrasladocomponent',
  standalone: false,
  styleUrl: './nuevotrasladocomponent.css',
  templateUrl: './nuevotrasladocomponent.html',
})
export class Nuevotrasladocomponent implements OnInit {
  sedes: SedeModel[] = [];
  codigo: string = '';
  ejemplar: EjemplarConsultaModel | null = null;
  idSedeDestino: number | null = null;
  motivo: string = '';
  errorCodigo: string = '';
  errorSede: string = '';
  errorMotivo: string = '';
  errorCarga: string = '';
  errorGuardar: string = '';
  buscando: boolean = false;
  guardando: boolean = false;

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private libroService: LibroService,
    private trasladoService: TrasladoService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
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
  }

  sedesDestino(): SedeModel[] {
    const destinos: SedeModel[] = [];
    for (const sede of this.sedes) {
      if (this.ejemplar === null || sede.idSede !== this.ejemplar.idSede) {
        destinos.push(sede);
      }
    }
    return destinos;
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

  validarSede(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige la sede de destino.';
    }
    if (this.ejemplar !== null && this.ejemplar.idSede === valor) {
      return 'El ejemplar ya está en esa sede.';
    }
    for (const sede of this.sedes) {
      if (sede.idSede === valor) {
        return '';
      }
    }
    return 'Elige una sede abierta de la lista.';
  }

  validarMotivo(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El motivo debe ser texto.';
    }
    if (valor.trim().length > 200) {
      return 'El motivo tiene máximo 200 caracteres.';
    }
    return '';
  }

  buscarEjemplar(): void {
    this.ejemplar = null;
    this.errorCodigo = this.validarCodigo(this.codigo);
    if (this.errorCodigo !== '') {
      return;
    }
    this.buscando = true;
    this.libroService.getEjemplarPorCodigo(this.codigo.trim()).subscribe({
      next: (ejemplar) => {
        this.ejemplar = ejemplar;
        if (this.idSedeDestino === ejemplar.idSede) {
          this.idSedeDestino = null;
        }
        this.buscando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorCodigo = this.auth.mensajeError(e);
        this.buscando = false;
        this.cdr.markForCheck();
      },
    });
  }

  registrar(): void {
    this.errorGuardar = '';
    this.errorSede = this.validarSede(this.idSedeDestino);
    this.errorMotivo = this.validarMotivo(this.motivo);
    if (this.ejemplar === null) {
      this.errorCodigo = 'Busca primero el ejemplar.';
    }
    if (
      this.ejemplar === null ||
      this.errorSede !== '' ||
      this.errorMotivo !== '' ||
      this.idSedeDestino === null
    ) {
      return;
    }
    this.guardando = true;
    this.trasladoService
      .solicitarTraslado(this.ejemplar.idEjemplar, this.idSedeDestino, this.motivo.trim())
      .subscribe({
        next: (resultado) => {
          this.router.navigate(['/traslados'], { state: { mensaje: resultado.mensaje } });
        },
        error: (e: unknown) => {
          this.errorGuardar = this.auth.mensajeError(e);
          this.guardando = false;
          this.cdr.markForCheck();
        },
      });
  }
}
