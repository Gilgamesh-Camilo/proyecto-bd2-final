import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AutorFilaModel } from '../../models/autor-fila.model';
import { AutorOpcionModel } from '../../models/autor-opcion.model';
import { AutorRegistroModel } from '../../models/autor-registro.model';
import { CategoriaModel } from '../../models/categoria.model';
import { EditorialModel } from '../../models/editorial.model';
import { SedeModel } from '../../models/sede.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { LibroService } from '../../services/libro.service';

@Component({
  selector: 'app-nuevolibrocomponent',
  standalone: false,
  styleUrl: './nuevolibrocomponent.css',
  templateUrl: './nuevolibrocomponent.html',
})
export class Nuevolibrocomponent implements OnInit {
  idiomas: string[] = ['es', 'en', 'fr', 'pt', 'it', 'de'];
  roles: string[] = ['AUTOR', 'COAUTOR', 'EDITOR', 'TRADUCTOR', 'ILUSTRADOR'];
  editoriales: EditorialModel[] = [];
  categorias: CategoriaModel[] = [];
  sedes: SedeModel[] = [];
  autoresRegistrados: AutorOpcionModel[] = [];
  anioActual: number = 0;

  isbn: string = '';
  titulo: string = '';
  subtitulo: string = '';
  idEditorial: number | null = null;
  idCategoria: number | null = null;
  idioma: string = 'es';
  anioPublicacion: number | null = null;
  edicion: number | null = 1;
  numeroPaginas: number | null = null;
  autores: AutorFilaModel[] = [];
  idSede: number | null = null;
  cantidad: number | null = 1;
  ubicacionEstante: string = '';
  valorReposicion: number | null = null;
  sinopsis: string = '';
  palabrasClave: string = '';

  errorIsbn: string = '';
  errorTitulo: string = '';
  errorSubtitulo: string = '';
  errorEditorial: string = '';
  errorCategoria: string = '';
  errorIdioma: string = '';
  errorAnio: string = '';
  errorEdicion: string = '';
  errorPaginas: string = '';
  errorAutores: string = '';
  errorSede: string = '';
  errorCantidad: string = '';
  errorUbicacion: string = '';
  errorValor: string = '';
  errorSinopsis: string = '';
  errorPalabras: string = '';
  errorCarga: string = '';
  errorGuardar: string = '';
  guardando: boolean = false;

  private letras: RegExp = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;
  private enteroMaximo: number = 2147483647;

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private libroService: LibroService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.anioActual = new Date().getFullYear();
    this.autores.push(this.nuevaFila());
    this.catalogoService.getCatalogos().subscribe({
      next: (catalogos) => {
        this.categorias = catalogos.categorias;
        this.sedes = [];
        for (const sede of catalogos.sedes) {
          if (sede.estado === 'ACTIVA') {
            this.sedes.push(sede);
          }
        }
        const empleado = this.auth.getEmpleado();
        if (empleado !== null) {
          for (const sede of this.sedes) {
            if (sede.idSede === empleado.idSede) {
              this.idSede = sede.idSede;
            }
          }
        }
        this.cdr.markForCheck();
      },
      error: (e: unknown) => this.fallarCarga(e),
    });
    this.libroService.getEditoriales().subscribe({
      next: (editoriales) => {
        this.editoriales = editoriales;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => this.fallarCarga(e),
    });
    this.libroService.getAutores().subscribe({
      next: (autores) => {
        this.autoresRegistrados = autores;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => this.fallarCarga(e),
    });
  }

  nombreIdioma(codigo: string): string {
    if (codigo === 'es') {
      return 'Español';
    }
    if (codigo === 'en') {
      return 'Inglés';
    }
    if (codigo === 'fr') {
      return 'Francés';
    }
    if (codigo === 'pt') {
      return 'Portugués';
    }
    if (codigo === 'it') {
      return 'Italiano';
    }
    return 'Alemán';
  }

  nombreRol(rol: string): string {
    return rol.charAt(0) + rol.substring(1).toLowerCase();
  }

  agregarAutor(): void {
    this.autores.push(this.nuevaFila());
    this.errorAutores = '';
  }

  quitarAutor(indice: number): void {
    if (this.autores.length <= 1) {
      this.errorAutores = 'El libro debe tener al menos un autor.';
      return;
    }
    this.autores.splice(indice, 1);
    this.errorAutores = '';
  }

  cambiarOrigen(fila: AutorFilaModel): void {
    fila.idAutor = null;
    fila.nombres = '';
    fila.apellidos = '';
    fila.nacionalidad = '';
    fila.errorAutor = '';
    fila.errorNombres = '';
    fila.errorApellidos = '';
    fila.errorNacionalidad = '';
  }

  validarIsbn(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El ISBN debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe el ISBN.';
    }
    if (!/^[0-9]{13}$/.test(valor.trim())) {
      return 'El ISBN debe tener 13 dígitos, sin guiones ni espacios.';
    }
    return '';
  }

  validarTitulo(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El título debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe el título.';
    }
    if (valor.trim().length > 200) {
      return 'El título tiene máximo 200 caracteres.';
    }
    return '';
  }

  validarSubtitulo(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El subtítulo debe ser texto.';
    }
    if (valor.trim().length > 200) {
      return 'El subtítulo tiene máximo 200 caracteres.';
    }
    return '';
  }

  validarEditorial(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige la editorial.';
    }
    for (const editorial of this.editoriales) {
      if (editorial.idEditorial === valor) {
        return '';
      }
    }
    return 'Elige la editorial.';
  }

  validarCategoria(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige la categoría.';
    }
    for (const categoria of this.categorias) {
      if (categoria.idCategoria === valor) {
        return '';
      }
    }
    return 'Elige la categoría.';
  }

  validarIdioma(valor: unknown): string {
    if (typeof valor !== 'string' || this.idiomas.indexOf(valor) === -1) {
      return 'Elige un idioma de la lista.';
    }
    return '';
  }

  validarAnio(valor: unknown): string {
    if (valor === null) {
      return '';
    }
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      return 'El año debe ser un número entero.';
    }
    if (valor < 1450 || valor > this.anioActual) {
      return 'El año debe estar entre 1450 y ' + this.anioActual + '.';
    }
    return '';
  }

  validarEdicion(valor: unknown): string {
    if (valor === null) {
      return 'Escribe el número de la edición.';
    }
    return this.validarEnteroPositivo(valor, 'La edición');
  }

  validarPaginas(valor: unknown): string {
    if (valor === null) {
      return '';
    }
    return this.validarEnteroPositivo(valor, 'El número de páginas');
  }

  validarAutorRegistrado(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige el autor.';
    }
    for (const autor of this.autoresRegistrados) {
      if (autor.idAutor === valor) {
        return '';
      }
    }
    return 'Elige el autor.';
  }

  validarNombresAutor(valor: unknown): string {
    return this.validarNombre(valor, 'los nombres');
  }

  validarApellidosAutor(valor: unknown): string {
    return this.validarNombre(valor, 'los apellidos');
  }

  validarNacionalidad(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La nacionalidad debe ser texto.';
    }
    if (valor.trim() === '') {
      return '';
    }
    if (!this.letras.test(valor.trim())) {
      return 'Solo se admiten letras y espacios.';
    }
    if (valor.trim().length > 60) {
      return 'Máximo 60 caracteres.';
    }
    return '';
  }

  validarRol(valor: unknown): string {
    if (typeof valor !== 'string' || this.roles.indexOf(valor) === -1) {
      return 'Elige el rol.';
    }
    return '';
  }

  validarAutores(): boolean {
    let valido: boolean = true;
    this.errorAutores = '';
    if (this.autores.length === 0) {
      this.errorAutores = 'El libro debe tener al menos un autor.';
      return false;
    }
    const elegidos: number[] = [];
    for (const fila of this.autores) {
      fila.errorAutor = '';
      fila.errorNombres = '';
      fila.errorApellidos = '';
      fila.errorNacionalidad = '';
      fila.errorRol = this.validarRol(fila.rolAutor);
      if (fila.origen === 'REGISTRADO') {
        fila.errorAutor = this.validarAutorRegistrado(fila.idAutor);
        if (fila.errorAutor === '' && fila.idAutor !== null) {
          if (elegidos.indexOf(fila.idAutor) !== -1) {
            fila.errorAutor = 'Este autor ya está en la lista.';
          }
          elegidos.push(fila.idAutor);
        }
      } else if (fila.origen === 'NUEVO') {
        fila.errorNombres = this.validarNombresAutor(fila.nombres);
        fila.errorApellidos = this.validarApellidosAutor(fila.apellidos);
        fila.errorNacionalidad = this.validarNacionalidad(fila.nacionalidad);
      } else {
        fila.errorAutor = 'Elige si el autor ya está registrado o es nuevo.';
      }
      if (
        fila.errorAutor !== '' ||
        fila.errorNombres !== '' ||
        fila.errorApellidos !== '' ||
        fila.errorNacionalidad !== '' ||
        fila.errorRol !== ''
      ) {
        valido = false;
      }
    }
    return valido;
  }

  validarSede(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige la sede.';
    }
    for (const sede of this.sedes) {
      if (sede.idSede === valor) {
        return '';
      }
    }
    return 'Elige la sede.';
  }

  validarCantidad(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      return 'La cantidad debe ser un número entero.';
    }
    if (valor < 1 || valor > 20) {
      return 'La cantidad va de 1 a 20 ejemplares.';
    }
    return '';
  }

  validarUbicacion(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La ubicación debe ser texto.';
    }
    if (valor.trim().length > 30) {
      return 'La ubicación tiene máximo 30 caracteres.';
    }
    return '';
  }

  validarValor(valor: unknown): string {
    if (valor === null) {
      return '';
    }
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      return 'El valor debe ser un número.';
    }
    if (valor < 0 || valor > 9999999999) {
      return 'El valor debe estar entre 0 y 9999999999.';
    }
    if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(String(valor))) {
      return 'El valor admite máximo dos decimales.';
    }
    return '';
  }

  validarSinopsis(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La sinopsis debe ser texto.';
    }
    return '';
  }

  validarPalabras(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'Las palabras clave deben ser texto.';
    }
    return '';
  }

  registrar(): void {
    this.errorGuardar = '';
    this.errorIsbn = this.validarIsbn(this.isbn);
    this.errorTitulo = this.validarTitulo(this.titulo);
    this.errorSubtitulo = this.validarSubtitulo(this.subtitulo);
    this.errorEditorial = this.validarEditorial(this.idEditorial);
    this.errorCategoria = this.validarCategoria(this.idCategoria);
    this.errorIdioma = this.validarIdioma(this.idioma);
    this.errorAnio = this.validarAnio(this.anioPublicacion);
    this.errorEdicion = this.validarEdicion(this.edicion);
    this.errorPaginas = this.validarPaginas(this.numeroPaginas);
    this.errorSede = this.validarSede(this.idSede);
    this.errorCantidad = this.validarCantidad(this.cantidad);
    this.errorUbicacion = this.validarUbicacion(this.ubicacionEstante);
    this.errorValor = this.validarValor(this.valorReposicion);
    this.errorSinopsis = this.validarSinopsis(this.sinopsis);
    this.errorPalabras = this.validarPalabras(this.palabrasClave);
    const autoresValidos = this.validarAutores();
    if (
      this.errorIsbn !== '' ||
      this.errorTitulo !== '' ||
      this.errorSubtitulo !== '' ||
      this.errorEditorial !== '' ||
      this.errorCategoria !== '' ||
      this.errorIdioma !== '' ||
      this.errorAnio !== '' ||
      this.errorEdicion !== '' ||
      this.errorPaginas !== '' ||
      this.errorSede !== '' ||
      this.errorCantidad !== '' ||
      this.errorUbicacion !== '' ||
      this.errorValor !== '' ||
      this.errorSinopsis !== '' ||
      this.errorPalabras !== '' ||
      !autoresValidos ||
      this.idEditorial === null ||
      this.idCategoria === null ||
      this.edicion === null ||
      this.idSede === null ||
      this.cantidad === null
    ) {
      this.errorGuardar = 'Revisa los campos marcados en rojo.';
      return;
    }
    const autores: AutorRegistroModel[] = [];
    for (const fila of this.autores) {
      if (fila.origen === 'REGISTRADO') {
        autores.push({
          idAutor: fila.idAutor,
          nombres: null,
          apellidos: null,
          nacionalidad: null,
          rolAutor: fila.rolAutor,
        });
      } else {
        autores.push({
          idAutor: null,
          nombres: fila.nombres.trim(),
          apellidos: fila.apellidos.trim(),
          nacionalidad: this.textoOpcional(fila.nacionalidad),
          rolAutor: fila.rolAutor,
        });
      }
    }
    this.guardando = true;
    this.libroService
      .registrarLibro({
        isbn: this.isbn.trim(),
        titulo: this.titulo.trim(),
        subtitulo: this.textoOpcional(this.subtitulo),
        anioPublicacion: this.anioPublicacion,
        edicion: this.edicion,
        numeroPaginas: this.numeroPaginas,
        idioma: this.idioma,
        idEditorial: this.idEditorial,
        idCategoria: this.idCategoria,
        autores: autores,
        sinopsis: this.textoOpcional(this.sinopsis),
        palabrasClave: this.listaPalabras(this.palabrasClave),
        ejemplares: {
          idSede: this.idSede,
          cantidad: this.cantidad,
          ubicacionEstante: this.textoOpcional(this.ubicacionEstante),
          valorReposicion: this.valorReposicion,
        },
      })
      .subscribe({
        next: (resultado) => {
          if (resultado.id === null) {
            this.router.navigate(['/catalogo']);
            return;
          }
          this.router.navigate(['/catalogo', resultado.id], {
            state: { mensaje: resultado.mensaje },
          });
        },
        error: (e: unknown) => {
          this.errorGuardar = this.auth.mensajeError(e);
          this.guardando = false;
          this.cdr.markForCheck();
        },
      });
  }

  private nuevaFila(): AutorFilaModel {
    return {
      origen: 'REGISTRADO',
      idAutor: null,
      nombres: '',
      apellidos: '',
      nacionalidad: '',
      rolAutor: 'AUTOR',
      errorAutor: '',
      errorNombres: '',
      errorApellidos: '',
      errorNacionalidad: '',
      errorRol: '',
    };
  }

  private validarNombre(valor: unknown, campo: string): string {
    if (typeof valor !== 'string') {
      return 'El campo debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe ' + campo + '.';
    }
    if (!this.letras.test(valor.trim())) {
      return 'Solo se admiten letras y espacios.';
    }
    if (valor.trim().length > 80) {
      return 'Máximo 80 caracteres.';
    }
    return '';
  }

  private validarEnteroPositivo(valor: unknown, campo: string): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      return campo + ' debe ser un número entero.';
    }
    if (valor < 1) {
      return campo + ' debe ser mayor que cero.';
    }
    if (valor > this.enteroMaximo) {
      return campo + ' es demasiado grande.';
    }
    return '';
  }

  private listaPalabras(valor: string): string[] {
    const palabras: string[] = [];
    for (const parte of valor.split(',')) {
      const limpia = parte.trim();
      if (limpia !== '') {
        palabras.push(limpia);
      }
    }
    return palabras;
  }

  private textoOpcional(valor: string): string | null {
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }

  private fallarCarga(e: unknown): void {
    this.errorCarga = this.auth.mensajeError(e);
    this.cdr.markForCheck();
  }
}
