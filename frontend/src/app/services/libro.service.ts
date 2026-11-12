import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AutorOpcionModel } from '../models/autor-opcion.model';
import { AutorModel } from '../models/autor.model';
import { CalificacionModel } from '../models/calificacion.model';
import { DisponibilidadSedeModel } from '../models/disponibilidad-sede.model';
import { EditorialModel } from '../models/editorial.model';
import { EjemplarConsultaModel } from '../models/ejemplar-consulta.model';
import { EjemplarRegistroModel } from '../models/ejemplar-registro.model';
import { EjemplarModel } from '../models/ejemplar.model';
import { FichaModel } from '../models/ficha.model';
import { LibroDetalleModel } from '../models/libro-detalle.model';
import { LibroRegistroModel } from '../models/libro-registro.model';
import { LibroModel } from '../models/libro.model';
import { ResultadoModel } from '../models/resultado.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class LibroService {
  private url: string = 'http://localhost:8000/api';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getLibros(
    termino: string,
    idCategoria: number | null,
    idSede: number | null,
  ): Observable<LibroModel[]> {
    let parametros = new HttpParams();
    if (termino !== '') {
      parametros = parametros.set('q', termino);
    }
    if (idCategoria !== null) {
      parametros = parametros.set('id_categoria', String(idCategoria));
    }
    if (idSede !== null) {
      parametros = parametros.set('id_sede', String(idSede));
    }
    return this.http
      .get<unknown>(this.url + '/libros/', { headers: this.auth.getHeaders(), params: parametros })
      .pipe(
        map((respuesta) => {
          if (!Array.isArray(respuesta)) {
            throw this.datos.error();
          }
          const libros: LibroModel[] = [];
          for (const elemento of respuesta) {
            libros.push(this.aLibro(elemento));
          }
          return libros;
        }),
      );
  }

  public getLibro(idLibro: number): Observable<LibroDetalleModel> {
    return this.http
      .get<unknown>(this.url + '/libros/' + idLibro + '/', { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.aLibroDetalle(respuesta)));
  }

  public getEjemplarPorCodigo(codigo: string): Observable<EjemplarConsultaModel> {
    const parametros = new HttpParams().set('codigo', codigo);
    return this.http
      .get<unknown>(this.url + '/ejemplares/', {
        headers: this.auth.getHeaders(),
        params: parametros,
      })
      .pipe(
        map((respuesta) => {
          const d = this.datos.objeto(respuesta);
          if (d === null) {
            throw this.datos.error();
          }
          const idEjemplar = this.datos.numero(d['id_ejemplar']);
          const codigoBarras = this.datos.texto(d['codigo_barras']);
          const estado = this.datos.texto(d['estado']);
          const idSede = this.datos.numero(d['id_sede']);
          const sede = this.datos.texto(d['sede']);
          const idLibro = this.datos.numero(d['id_libro']);
          const titulo = this.datos.texto(d['titulo']);
          if (
            idEjemplar === null ||
            codigoBarras === null ||
            estado === null ||
            idSede === null ||
            sede === null ||
            idLibro === null ||
            titulo === null
          ) {
            throw this.datos.error();
          }
          return {
            idEjemplar: idEjemplar,
            codigoBarras: codigoBarras,
            estado: estado,
            idSede: idSede,
            sede: sede,
            idLibro: idLibro,
            titulo: titulo,
          };
        }),
      );
  }

  public getEditoriales(): Observable<EditorialModel[]> {
    return this.http
      .get<unknown>(this.url + '/editoriales/', { headers: this.auth.getHeaders() })
      .pipe(
        map((respuesta) => {
          if (!Array.isArray(respuesta)) {
            throw this.datos.error();
          }
          const editoriales: EditorialModel[] = [];
          for (const elemento of respuesta) {
            const d = this.datos.objeto(elemento);
            if (d === null) {
              throw this.datos.error();
            }
            const idEditorial = this.datos.numero(d['id_editorial']);
            const nombre = this.datos.texto(d['nombre']);
            if (idEditorial === null || nombre === null) {
              throw this.datos.error();
            }
            editoriales.push({
              idEditorial: idEditorial,
              nombre: nombre,
              pais: this.datos.texto(d['pais']),
            });
          }
          return editoriales;
        }),
      );
  }

  public getAutores(): Observable<AutorOpcionModel[]> {
    return this.http.get<unknown>(this.url + '/autores/', { headers: this.auth.getHeaders() }).pipe(
      map((respuesta) => {
        if (!Array.isArray(respuesta)) {
          throw this.datos.error();
        }
        const autores: AutorOpcionModel[] = [];
        for (const elemento of respuesta) {
          const d = this.datos.objeto(elemento);
          if (d === null) {
            throw this.datos.error();
          }
          const idAutor = this.datos.numero(d['id_autor']);
          const nombres = this.datos.texto(d['nombres']);
          const apellidos = this.datos.texto(d['apellidos']);
          if (idAutor === null || nombres === null || apellidos === null) {
            throw this.datos.error();
          }
          autores.push({
            idAutor: idAutor,
            nombres: nombres,
            apellidos: apellidos,
            nacionalidad: this.datos.texto(d['nacionalidad']),
          });
        }
        return autores;
      }),
    );
  }

  public registrarLibro(libro: LibroRegistroModel): Observable<ResultadoModel> {
    const autores: Record<string, unknown>[] = [];
    for (const autor of libro.autores) {
      autores.push({
        id_autor: autor.idAutor,
        nombres: autor.nombres,
        apellidos: autor.apellidos,
        nacionalidad: autor.nacionalidad,
        rol_autor: autor.rolAutor,
      });
    }
    const cuerpo = {
      isbn: libro.isbn,
      titulo: libro.titulo,
      subtitulo: libro.subtitulo,
      anio_publicacion: libro.anioPublicacion,
      edicion: libro.edicion,
      numero_paginas: libro.numeroPaginas,
      idioma: libro.idioma,
      id_editorial: libro.idEditorial,
      id_categoria: libro.idCategoria,
      autores: autores,
      sinopsis: libro.sinopsis,
      palabras_clave: libro.palabrasClave,
      id_sede: libro.ejemplares.idSede,
      cantidad: libro.ejemplares.cantidad,
      ubicacion_estante: libro.ejemplares.ubicacionEstante,
      valor_reposicion: libro.ejemplares.valorReposicion,
    };
    return this.http
      .post<unknown>(this.url + '/libros/', cuerpo, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, 'p_id_libro')));
  }

  public registrarEjemplares(
    idLibro: number,
    ejemplares: EjemplarRegistroModel,
  ): Observable<ResultadoModel> {
    const cuerpo = {
      id_sede: ejemplares.idSede,
      cantidad: ejemplares.cantidad,
      ubicacion_estante: ejemplares.ubicacionEstante,
      valor_reposicion: ejemplares.valorReposicion,
    };
    return this.http
      .post<unknown>(this.url + '/libros/' + idLibro + '/ejemplares/', cuerpo, {
        headers: this.auth.getHeaders(),
      })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public cambiarEstadoEjemplar(idEjemplar: number, estado: string): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(
        this.url + '/ejemplares/' + idEjemplar + '/estado/',
        { estado: estado },
        { headers: this.auth.getHeaders() },
      )
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  private aLibro(valor: unknown): LibroModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idLibro = this.datos.numero(d['id_libro']);
    const isbn = this.datos.texto(d['isbn']);
    const titulo = this.datos.texto(d['titulo']);
    const idioma = this.datos.texto(d['idioma']);
    const categoria = this.datos.texto(d['categoria']);
    const editorial = this.datos.texto(d['editorial']);
    const autores = this.datos.texto(d['autores']);
    const totalEjemplares = this.datos.numero(d['total_ejemplares']);
    const disponibles = this.datos.numero(d['disponibles']);
    if (
      idLibro === null ||
      isbn === null ||
      titulo === null ||
      idioma === null ||
      categoria === null ||
      editorial === null ||
      autores === null ||
      totalEjemplares === null ||
      disponibles === null
    ) {
      throw this.datos.error();
    }
    const porSede: DisponibilidadSedeModel[] = [];
    for (const elemento of this.datos.lista(d['por_sede'])) {
      porSede.push(this.aDisponibilidadSede(elemento));
    }
    return {
      idLibro: idLibro,
      isbn: isbn,
      titulo: titulo,
      subtitulo: this.datos.texto(d['subtitulo']),
      anioPublicacion: this.datos.numero(d['anio_publicacion']),
      idioma: idioma,
      categoria: categoria,
      editorial: editorial,
      autores: autores,
      totalEjemplares: totalEjemplares,
      disponibles: disponibles,
      porSede: porSede,
    };
  }

  private aDisponibilidadSede(valor: unknown): DisponibilidadSedeModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idSede = this.datos.numero(d['id_sede']);
    const sede = this.datos.texto(d['sede']);
    const total = this.datos.numero(d['total']);
    const disponibles = this.datos.numero(d['disponibles']);
    if (idSede === null || sede === null || total === null || disponibles === null) {
      throw this.datos.error();
    }
    return { idSede: idSede, sede: sede, total: total, disponibles: disponibles };
  }

  private aLibroDetalle(valor: unknown): LibroDetalleModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idLibro = this.datos.numero(d['id_libro']);
    const isbn = this.datos.texto(d['isbn']);
    const titulo = this.datos.texto(d['titulo']);
    const edicion = this.datos.numero(d['edicion']);
    const idioma = this.datos.texto(d['idioma']);
    const categoria = this.datos.texto(d['categoria']);
    const codigoDewey = this.datos.texto(d['codigo_dewey']);
    const editorial = this.datos.texto(d['editorial']);
    if (
      idLibro === null ||
      isbn === null ||
      titulo === null ||
      edicion === null ||
      idioma === null ||
      categoria === null ||
      codigoDewey === null ||
      editorial === null
    ) {
      throw this.datos.error();
    }
    const autores: AutorModel[] = [];
    for (const elemento of this.datos.lista(d['autores'])) {
      autores.push(this.aAutor(elemento));
    }
    const ejemplares: EjemplarModel[] = [];
    for (const elemento of this.datos.lista(d['ejemplares'])) {
      ejemplares.push(this.aEjemplar(elemento));
    }
    return {
      idLibro: idLibro,
      isbn: isbn,
      titulo: titulo,
      subtitulo: this.datos.texto(d['subtitulo']),
      anioPublicacion: this.datos.numero(d['anio_publicacion']),
      edicion: edicion,
      numeroPaginas: this.datos.numero(d['numero_paginas']),
      idioma: idioma,
      categoria: categoria,
      codigoDewey: codigoDewey,
      editorial: editorial,
      paisEditorial: this.datos.texto(d['pais_editorial']),
      autores: autores,
      ejemplares: ejemplares,
      ficha: this.aFicha(d['ficha']),
      calificacion: this.aCalificacion(d['calificacion']),
    };
  }

  private aAutor(valor: unknown): AutorModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idAutor = this.datos.numero(d['id_autor']);
    const nombres = this.datos.texto(d['nombres']);
    const apellidos = this.datos.texto(d['apellidos']);
    const rolAutor = this.datos.texto(d['rol_autor']);
    const orden = this.datos.numero(d['orden']);
    if (
      idAutor === null ||
      nombres === null ||
      apellidos === null ||
      rolAutor === null ||
      orden === null
    ) {
      throw this.datos.error();
    }
    return {
      idAutor: idAutor,
      nombres: nombres,
      apellidos: apellidos,
      nacionalidad: this.datos.texto(d['nacionalidad']),
      rolAutor: rolAutor,
      orden: orden,
    };
  }

  private aEjemplar(valor: unknown): EjemplarModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idEjemplar = this.datos.numero(d['id_ejemplar']);
    const codigoBarras = this.datos.texto(d['codigo_barras']);
    const estado = this.datos.texto(d['estado']);
    const idSede = this.datos.numero(d['id_sede']);
    const sede = this.datos.texto(d['sede']);
    if (
      idEjemplar === null ||
      codigoBarras === null ||
      estado === null ||
      idSede === null ||
      sede === null
    ) {
      throw this.datos.error();
    }
    return {
      idEjemplar: idEjemplar,
      codigoBarras: codigoBarras,
      estado: estado,
      ubicacionEstante: this.datos.texto(d['ubicacion_estante']),
      idSede: idSede,
      sede: sede,
    };
  }

  private aFicha(valor: unknown): FichaModel | null {
    const d = this.datos.objeto(valor);
    if (d === null) {
      return null;
    }
    const capitulos: string[] = [];
    for (const elemento of this.datos.lista(d['tabla_contenido'])) {
      const capitulo = this.datos.objeto(elemento);
      if (capitulo !== null) {
        const numero = this.datos.numero(capitulo['capitulo']);
        const titulo = this.datos.texto(capitulo['titulo']);
        if (numero !== null && titulo !== null) {
          capitulos.push('Capítulo ' + numero + ': ' + titulo);
        }
      }
    }
    const premios: string[] = [];
    for (const elemento of this.datos.lista(d['premios'])) {
      const premio = this.datos.objeto(elemento);
      if (premio !== null) {
        const nombre = this.datos.texto(premio['nombre']);
        const anio = this.datos.numero(premio['anio']);
        if (nombre !== null && anio !== null) {
          premios.push(nombre + ' (' + anio + ')');
        }
      }
    }
    const adaptaciones: string[] = [];
    for (const elemento of this.datos.lista(d['adaptaciones'])) {
      const adaptacion = this.datos.objeto(elemento);
      if (adaptacion !== null) {
        const tipo = this.datos.texto(adaptacion['tipo']);
        const titulo = this.datos.texto(adaptacion['titulo']);
        const anio = this.datos.numero(adaptacion['anio']);
        if (tipo !== null && titulo !== null && anio !== null) {
          adaptaciones.push(titulo + ' (' + tipo + ', ' + anio + ')');
        }
      }
    }
    const sinopsis = this.datos.texto(d['sinopsis']);
    const nivel = this.datos.texto(d['nivel']);
    return {
      sinopsis: sinopsis === null ? '' : sinopsis,
      palabrasClave: this.datos.textos(d['palabras_clave']),
      capitulos: capitulos,
      premios: premios,
      adaptaciones: adaptaciones,
      nivel: nivel === null ? '' : nivel,
    };
  }

  private aCalificacion(valor: unknown): CalificacionModel | null {
    const d = this.datos.objeto(valor);
    if (d === null) {
      return null;
    }
    const total = this.datos.numero(d['total']);
    if (total === null) {
      return null;
    }
    return { promedio: this.datos.numero(d['promedio']), total: total };
  }
}
