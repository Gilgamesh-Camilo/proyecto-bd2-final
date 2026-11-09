import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ReservaModel } from '../models/reserva.model';
import { ResultadoModel } from '../models/resultado.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class ReservaService {
  private url: string = 'http://localhost:8000/api/reservas/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getReservas(estado: string): Observable<ReservaModel[]> {
    let parametros = new HttpParams();
    if (estado !== '') {
      parametros = parametros.set('estado', estado);
    }
    return this.http
      .get<unknown>(this.url, { headers: this.auth.getHeaders(), params: parametros })
      .pipe(map((respuesta) => this.aReservas(respuesta)));
  }

  public crearReserva(
    idSocio: number,
    idLibro: number,
    idSede: number,
  ): Observable<ResultadoModel> {
    const cuerpo = { id_socio: idSocio, id_libro: idLibro, id_sede: idSede };
    return this.http
      .post<unknown>(this.url, cuerpo, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, 'p_id_reserva')));
  }

  public cancelarReserva(idReserva: number): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(
        this.url + idReserva + '/cancelacion/',
        {},
        { headers: this.auth.getHeaders() },
      )
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public aReservas(valor: unknown): ReservaModel[] {
    if (!Array.isArray(valor)) {
      throw this.datos.error();
    }
    const reservas: ReservaModel[] = [];
    for (const elemento of valor) {
      reservas.push(this.aReserva(elemento));
    }
    return reservas;
  }

  private aReserva(valor: unknown): ReservaModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idReserva = this.datos.numero(d['id_reserva']);
    const idSocio = this.datos.numero(d['id_socio']);
    const socio = this.datos.texto(d['socio']);
    const numeroDocumento = this.datos.texto(d['numero_documento']);
    const idLibro = this.datos.numero(d['id_libro']);
    const titulo = this.datos.texto(d['titulo']);
    const sedeRetiro = this.datos.texto(d['sede_retiro']);
    const fechaReserva = this.datos.texto(d['fecha_reserva']);
    const estado = this.datos.texto(d['estado']);
    if (
      idReserva === null ||
      idSocio === null ||
      socio === null ||
      numeroDocumento === null ||
      idLibro === null ||
      titulo === null ||
      sedeRetiro === null ||
      fechaReserva === null ||
      estado === null
    ) {
      throw this.datos.error();
    }
    return {
      idReserva: idReserva,
      idSocio: idSocio,
      socio: socio,
      numeroDocumento: numeroDocumento,
      idLibro: idLibro,
      titulo: titulo,
      sedeRetiro: sedeRetiro,
      codigoBarras: this.datos.texto(d['codigo_barras']),
      fechaReserva: fechaReserva,
      fechaExpiracion: this.datos.texto(d['fecha_expiracion']),
      estado: estado,
    };
  }
}
