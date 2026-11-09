import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ResenaModel } from '../models/resena.model';
import { ResultadoModel } from '../models/resultado.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class ResenaService {
  private url: string = 'http://localhost:8000/api';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getResenas(idLibro: number): Observable<ResenaModel[]> {
    return this.http
      .get<unknown>(this.url + '/libros/' + idLibro + '/resenas/', {
        headers: this.auth.getHeaders(),
      })
      .pipe(
        map((respuesta) => {
          if (!Array.isArray(respuesta)) {
            throw this.datos.error();
          }
          const resenas: ResenaModel[] = [];
          for (const elemento of respuesta) {
            resenas.push(this.aResena(elemento));
          }
          return resenas;
        }),
      );
  }

  public crearResena(
    idLibro: number,
    idSocio: number,
    calificacion: number,
    titulo: string,
    texto: string,
  ): Observable<ResultadoModel> {
    const cuerpo = {
      id_socio: idSocio,
      calificacion: calificacion,
      titulo: titulo,
      texto: texto,
    };
    return this.http
      .post<unknown>(this.url + '/libros/' + idLibro + '/resenas/', cuerpo, {
        headers: this.auth.getHeaders(),
      })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public actualizarResena(
    idResena: string,
    calificacion: number,
    titulo: string,
    texto: string,
  ): Observable<ResultadoModel> {
    const cuerpo = { calificacion: calificacion, titulo: titulo, texto: texto };
    return this.http
      .put<unknown>(this.url + '/resenas/' + encodeURIComponent(idResena) + '/', cuerpo, {
        headers: this.auth.getHeaders(),
      })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public eliminarResena(idResena: string): Observable<ResultadoModel> {
    return this.http
      .delete<unknown>(this.url + '/resenas/' + encodeURIComponent(idResena) + '/', {
        headers: this.auth.getHeaders(),
      })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  private aResena(valor: unknown): ResenaModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const id = this.datos.texto(d['id']);
    const socio = this.datos.texto(d['socio']);
    const calificacion = this.datos.numero(d['calificacion']);
    const titulo = this.datos.texto(d['titulo']);
    const texto = this.datos.texto(d['texto']);
    const fecha = this.datos.texto(d['fecha']);
    if (
      id === null ||
      socio === null ||
      calificacion === null ||
      titulo === null ||
      texto === null ||
      fecha === null
    ) {
      throw this.datos.error();
    }
    return {
      id: id,
      idSocio: this.datos.numero(d['id_socio']),
      socio: socio,
      calificacion: calificacion,
      titulo: titulo,
      texto: texto,
      fecha: fecha,
      editada: d['editada'] === true,
      votosUtiles: this.datos.lista(d['votos_utiles']).length,
    };
  }
}
