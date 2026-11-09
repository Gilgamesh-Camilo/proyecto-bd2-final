import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EmpleadoModel } from '../../models/empleado.model';
import { LibroDetalleModel } from '../../models/libro-detalle.model';
import { ResenaModel } from '../../models/resena.model';
import { SocioModel } from '../../models/socio.model';
import { AuthService } from '../../services/auth.service';
import { LibroService } from '../../services/libro.service';
import { ResenaService } from '../../services/resena.service';
import { SocioService } from '../../services/socio.service';

@Component({
  selector: 'app-detallelibrocomponent',
  standalone: false,
  styleUrl: './detallelibrocomponent.css',
  templateUrl: './detallelibrocomponent.html',
})
export class Detallelibrocomponent implements OnInit {
  idLibro: number | null = null;
  libro: LibroDetalleModel | null = null;
  empleado: EmpleadoModel | null = null;
  cargando: boolean = true;
  error: string = '';
  estrellas: number[] = [1, 2, 3, 4, 5];

  resenas: ResenaModel[] = [];
  cargandoResenas: boolean = true;
  errorResenas: string = '';
  puedeBorrar: boolean = false;
  confirmandoBorrado: string | null = null;

  documentoSocio: string = '';
  socioResena: SocioModel | null = null;
  buscandoSocio: boolean = false;
  calificacion: number | null = null;
  tituloResena: string = '';
  textoResena: string = '';
  editandoId: string | null = null;
  errorDocumento: string = '';
  errorCalificacion: string = '';
  errorTitulo: string = '';
  errorTexto: string = '';
  errorGuardar: string = '';
  mensajeResena: string = '';
  guardando: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private libroService: LibroService,
    private resenaService: ResenaService,
    private socioService: SocioService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.empleado = this.auth.getEmpleado();
    this.puedeBorrar = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    const parametro: unknown = this.route.snapshot.paramMap.get('id');
    const errorId = this.validarId(parametro);
    if (errorId !== '') {
      this.error = errorId;
      this.cargando = false;
      this.cargandoResenas = false;
      return;
    }
    this.idLibro = Number(parametro);
    this.cargar();
    this.cargarResenas();
  }

  validarId(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'Falta el código del libro en la dirección.';
    }
    if (!/^[0-9]+$/.test(valor)) {
      return 'El código del libro debe ser un número entero positivo.';
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      return 'El código del libro debe ser un número entero positivo.';
    }
    return '';
  }

  cargar(): void {
    if (this.idLibro === null) {
      return;
    }
    this.cargando = true;
    this.libroService.getLibro(this.idLibro).subscribe({
      next: (libro) => {
        this.libro = libro;
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

  cargarResenas(): void {
    if (this.idLibro === null) {
      return;
    }
    this.cargandoResenas = true;
    this.errorResenas = '';
    this.resenaService.getResenas(this.idLibro).subscribe({
      next: (resenas) => {
        this.resenas = resenas;
        this.cargandoResenas = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorResenas = this.auth.mensajeError(e);
        this.cargandoResenas = false;
        this.cdr.markForCheck();
      },
    });
  }

  disponiblesEnMiSede(): number {
    if (this.libro === null || this.empleado === null) {
      return 0;
    }
    let total: number = 0;
    for (const ejemplar of this.libro.ejemplares) {
      if (ejemplar.idSede === this.empleado.idSede && ejemplar.estado === 'DISPONIBLE') {
        total = total + 1;
      }
    }
    return total;
  }

  nombreAutores(): string {
    if (this.libro === null || this.libro.autores.length === 0) {
      return 'Sin autor registrado';
    }
    const nombres: string[] = [];
    for (const autor of this.libro.autores) {
      let nombre = autor.nombres + ' ' + autor.apellidos;
      if (autor.rolAutor !== 'AUTOR') {
        nombre = nombre + ' (' + autor.rolAutor.toLowerCase() + ')';
      }
      nombres.push(nombre);
    }
    return nombres.join(', ');
  }

  esDeMiSede(idSede: number): boolean {
    return this.empleado !== null && this.empleado.idSede === idSede;
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

  validarCalificacion(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor)) {
      return 'Elige una calificación.';
    }
    if (valor < 1 || valor > 5) {
      return 'La calificación va de 1 a 5.';
    }
    return '';
  }

  validarTitulo(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El título debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe un título para la reseña.';
    }
    if (valor.trim().length > 80) {
      return 'El título tiene máximo 80 caracteres.';
    }
    return '';
  }

  validarTexto(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La reseña debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe la opinión del socio.';
    }
    if (valor.trim().length > 3000) {
      return 'La reseña tiene máximo 3000 caracteres.';
    }
    return '';
  }

  buscarSocio(): void {
    this.socioResena = null;
    this.errorDocumento = this.validarDocumento(this.documentoSocio);
    if (this.errorDocumento !== '') {
      return;
    }
    this.buscandoSocio = true;
    this.socioService.getPorDocumento(this.documentoSocio.trim()).subscribe({
      next: (socio) => {
        this.socioResena = socio;
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

  guardarResena(): void {
    this.mensajeResena = '';
    this.errorGuardar = '';
    this.errorCalificacion = this.validarCalificacion(this.calificacion);
    this.errorTitulo = this.validarTitulo(this.tituloResena);
    this.errorTexto = this.validarTexto(this.textoResena);
    if (this.editandoId === null && this.socioResena === null) {
      this.errorDocumento = 'Busca primero al socio que escribe la reseña.';
    }
    if (
      this.errorCalificacion !== '' ||
      this.errorTitulo !== '' ||
      this.errorTexto !== '' ||
      (this.editandoId === null && this.socioResena === null) ||
      this.idLibro === null ||
      typeof this.calificacion !== 'number'
    ) {
      return;
    }
    this.guardando = true;
    const titulo = this.tituloResena.trim();
    const texto = this.textoResena.trim();
    if (this.editandoId !== null) {
      this.resenaService
        .actualizarResena(this.editandoId, this.calificacion, titulo, texto)
        .subscribe({
          next: (resultado) => this.terminarGuardado(resultado.mensaje),
          error: (e: unknown) => this.fallarGuardado(e),
        });
      return;
    }
    if (this.socioResena !== null) {
      this.resenaService
        .crearResena(this.idLibro, this.socioResena.idSocio, this.calificacion, titulo, texto)
        .subscribe({
          next: (resultado) => this.terminarGuardado(resultado.mensaje),
          error: (e: unknown) => this.fallarGuardado(e),
        });
    }
  }

  textoBotonResena(): string {
    if (this.guardando) {
      return 'Guardando...';
    }
    if (this.editandoId === null) {
      return 'Publicar reseña';
    }
    return 'Guardar cambios';
  }

  editar(resena: ResenaModel): void {
    this.editandoId = resena.id;
    this.calificacion = resena.calificacion;
    this.tituloResena = resena.titulo;
    this.textoResena = resena.texto;
    this.socioResena = null;
    this.documentoSocio = '';
    this.limpiarErrores();
    this.mensajeResena = '';
  }

  cancelarEdicion(): void {
    this.limpiarFormulario();
    this.mensajeResena = '';
  }

  pedirBorrado(resena: ResenaModel): void {
    this.confirmandoBorrado = resena.id;
  }

  eliminar(resena: ResenaModel): void {
    if (!this.puedeBorrar) {
      this.errorResenas = 'Tu rol no puede borrar reseñas.';
      return;
    }
    this.resenaService.eliminarResena(resena.id).subscribe({
      next: (resultado) => {
        this.mensajeResena = resultado.mensaje;
        this.confirmandoBorrado = null;
        if (this.editandoId === resena.id) {
          this.limpiarFormulario();
        }
        this.cargarResenas();
        this.cargar();
      },
      error: (e: unknown) => {
        this.errorResenas = this.auth.mensajeError(e);
        this.confirmandoBorrado = null;
        this.cdr.markForCheck();
      },
    });
  }

  private terminarGuardado(mensaje: string): void {
    this.guardando = false;
    this.limpiarFormulario();
    this.mensajeResena = mensaje;
    this.cargarResenas();
    this.cargar();
  }

  private fallarGuardado(e: unknown): void {
    this.guardando = false;
    this.errorGuardar = this.auth.mensajeError(e);
    this.cdr.markForCheck();
  }

  private limpiarErrores(): void {
    this.errorDocumento = '';
    this.errorCalificacion = '';
    this.errorTitulo = '';
    this.errorTexto = '';
    this.errorGuardar = '';
  }

  private limpiarFormulario(): void {
    this.editandoId = null;
    this.calificacion = null;
    this.tituloResena = '';
    this.textoResena = '';
    this.documentoSocio = '';
    this.socioResena = null;
    this.limpiarErrores();
  }
}
