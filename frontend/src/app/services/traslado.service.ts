import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ResultadoModel } from '../models/resultado.model';
import { TrasladoModel } from '../models/traslado.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class TrasladoService {
  private url: string = 'http://localhost:8000/api/traslados/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getTraslados(estado: string): Observable<TrasladoModel[]> {
    let parametros = new HttpParams();
    if (estado !== '') {
      parametros = parametros.set('estado', estado);
    }
    return this.http
      .get<unknown>(this.url, { headers: this.auth.getHeaders(), params: parametros })
      .pipe(
        map((respuesta) => {
          if (!Array.isArray(respuesta)) {
            throw this.datos.error();
          }
          const traslados: TrasladoModel[] = [];
          for (const elemento of respuesta) {
            traslados.push(this.aTraslado(elemento));
          }
          return traslados;
        }),
      );
  }

  public solicitarTraslado(
    idEjemplar: number,
    idSedeDestino: number,
    motivo: string,
  ): Observable<ResultadoModel> {
    const cuerpo = {
      id_ejemplar: idEjemplar,
      id_sede_destino: idSedeDestino,
      motivo: motivo === '' ? null : motivo,
    };
    return this.http
      .post<unknown>(this.url, cuerpo, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, 'p_id_traslado')));
  }

  public avanzarTraslado(idTraslado: number): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(this.url + idTraslado + '/avance/', {}, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  private aTraslado(valor: unknown): TrasladoModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idTraslado = this.datos.numero(d['id_traslado']);
    const codigoBarras = this.datos.texto(d['codigo_barras']);
    const titulo = this.datos.texto(d['titulo']);
    const idSedeOrigen = this.datos.numero(d['id_sede_origen']);
    const sedeOrigen = this.datos.texto(d['sede_origen']);
    const idSedeDestino = this.datos.numero(d['id_sede_destino']);
    const sedeDestino = this.datos.texto(d['sede_destino']);
    const solicitadoPor = this.datos.texto(d['solicitado_por']);
    const fechaSolicitud = this.datos.texto(d['fecha_solicitud']);
    const estado = this.datos.texto(d['estado']);
    if (
      idTraslado === null ||
      codigoBarras === null ||
      titulo === null ||
      idSedeOrigen === null ||
      sedeOrigen === null ||
      idSedeDestino === null ||
      sedeDestino === null ||
      solicitadoPor === null ||
      fechaSolicitud === null ||
      estado === null
    ) {
      throw this.datos.error();
    }
    return {
      idTraslado: idTraslado,
      codigoBarras: codigoBarras,
      titulo: titulo,
      idSedeOrigen: idSedeOrigen,
      sedeOrigen: sedeOrigen,
      idSedeDestino: idSedeDestino,
      sedeDestino: sedeDestino,
      solicitadoPor: solicitadoPor,
      fechaSolicitud: fechaSolicitud,
      fechaEnvio: this.datos.texto(d['fecha_envio']),
      fechaRecepcion: this.datos.texto(d['fecha_recepcion']),
      estado: estado,
      motivo: this.datos.texto(d['motivo']),
    };
  }
}
