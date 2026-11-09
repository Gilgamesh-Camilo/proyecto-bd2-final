import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MultaModel } from '../models/multa.model';
import { ResultadoModel } from '../models/resultado.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class MultaService {
  private url: string = 'http://localhost:8000/api/multas/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getMultas(estado: string): Observable<MultaModel[]> {
    let parametros = new HttpParams();
    if (estado !== '') {
      parametros = parametros.set('estado', estado);
    }
    return this.http
      .get<unknown>(this.url, { headers: this.auth.getHeaders(), params: parametros })
      .pipe(map((respuesta) => this.aMultas(respuesta)));
  }

  public pagarMulta(idPrestamo: number): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(this.url + idPrestamo + '/pago/', {}, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public aMultas(valor: unknown): MultaModel[] {
    if (!Array.isArray(valor)) {
      throw this.datos.error();
    }
    const multas: MultaModel[] = [];
    for (const elemento of valor) {
      multas.push(this.aMulta(elemento));
    }
    return multas;
  }

  private aMulta(valor: unknown): MultaModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idPrestamo = this.datos.numero(d['id_prestamo']);
    const motivo = this.datos.texto(d['motivo']);
    const monto = this.datos.numero(d['valor']);
    const estado = this.datos.texto(d['estado']);
    const fechaGeneracion = this.datos.texto(d['fecha_generacion']);
    const idSocio = this.datos.numero(d['id_socio']);
    const socio = this.datos.texto(d['socio']);
    const numeroDocumento = this.datos.texto(d['numero_documento']);
    const titulo = this.datos.texto(d['titulo']);
    if (
      idPrestamo === null ||
      motivo === null ||
      monto === null ||
      estado === null ||
      fechaGeneracion === null ||
      idSocio === null ||
      socio === null ||
      numeroDocumento === null ||
      titulo === null
    ) {
      throw this.datos.error();
    }
    return {
      idPrestamo: idPrestamo,
      motivo: motivo,
      valor: monto,
      estado: estado,
      fechaGeneracion: fechaGeneracion,
      fechaPago: this.datos.texto(d['fecha_pago']),
      idSocio: idSocio,
      socio: socio,
      numeroDocumento: numeroDocumento,
      titulo: titulo,
    };
  }
}
