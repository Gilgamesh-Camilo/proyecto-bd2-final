import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CategoriaModel } from '../../models/categoria.model';
import { ConteoModel } from '../../models/conteo.model';
import { DisponibilidadSedeModel } from '../../models/disponibilidad-sede.model';
import { LibroModel } from '../../models/libro.model';
import { SedeModel } from '../../models/sede.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { EstadisticaService } from '../../services/estadistica.service';
import { LibroService } from '../../services/libro.service';

@Component({
  selector: 'app-catalogocomponent',
  standalone: false,
  styleUrl: './catalogocomponent.css',
  templateUrl: './catalogocomponent.html',
})
export class Catalogocomponent implements OnInit {
  libros: LibroModel[] = [];
  columnasSede: DisponibilidadSedeModel[] = [];
  sedes: SedeModel[] = [];
  categorias: CategoriaModel[] = [];
  masPrestados: ConteoModel[] = [];
  sinResultado: ConteoModel[] = [];
  termino: string = '';
  idCategoria: number | null = null;
  idSede: number | null = null;
  terminoBuscado: string = '';
  errorTermino: string = '';
  errorCategoria: string = '';
  errorSede: string = '';
  cargando: boolean = true;
  error: string = '';
  errorCatalogos: string = '';
  errorEstadisticas: string = '';
  puedeRegistrar: boolean = false;

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private libroService: LibroService,
    private estadisticaService: EstadisticaService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.puedeRegistrar = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    this.catalogoService.getCatalogos().subscribe({
      next: (catalogos) => {
        this.sedes = catalogos.sedes;
        this.categorias = catalogos.categorias;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorCatalogos = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
    this.buscar();
    this.cargarEstadisticas();
  }

  validarTermino(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La búsqueda debe ser texto.';
    }
    if (valor.trim().length > 100) {
      return 'La búsqueda admite máximo 100 caracteres.';
    }
    return '';
  }

  validarCategoria(valor: unknown): string {
    if (valor === null) {
      return '';
    }
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige una categoría de la lista.';
    }
    for (const categoria of this.categorias) {
      if (categoria.idCategoria === valor) {
        return '';
      }
    }
    return 'Elige una categoría de la lista.';
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

  buscar(): void {
    this.errorTermino = this.validarTermino(this.termino);
    this.errorCategoria = this.validarCategoria(this.idCategoria);
    this.errorSede = this.validarSede(this.idSede);
    if (this.errorTermino !== '' || this.errorCategoria !== '' || this.errorSede !== '') {
      return;
    }
    const termino = this.termino.trim();
    this.cargando = true;
    this.error = '';
    this.libroService.getLibros(termino, this.idCategoria, this.idSede).subscribe({
      next: (libros) => {
        this.libros = libros;
        this.columnasSede = [];
        if (libros.length > 0) {
          this.columnasSede = libros[0].porSede;
        }
        this.terminoBuscado = termino;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.libros = [];
        this.columnasSede = [];
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  cargarEstadisticas(): void {
    this.estadisticaService.getEstadisticas().subscribe({
      next: (estadisticas) => {
        this.masPrestados = [];
        for (const fila of estadisticas.librosMasPrestados) {
          if (this.masPrestados.length < 4) {
            this.masPrestados.push(fila);
          }
        }
        this.sinResultado = [];
        for (const fila of estadisticas.busquedasSinResultado) {
          if (this.sinResultado.length < 4) {
            this.sinResultado.push(fila);
          }
        }
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorEstadisticas = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
  }

  estadoSede(disponibilidad: DisponibilidadSedeModel): string {
    if (disponibilidad.total === 0) {
      return 'sin';
    }
    if (disponibilidad.disponibles === 0) {
      return 'agotado';
    }
    return 'libre';
  }

  limpiar(): void {
    this.termino = '';
    this.idCategoria = null;
    this.idSede = null;
    this.buscar();
  }
}
