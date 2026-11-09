import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PrestamoDetalleModel } from '../models/prestamo-detalle.model';
import { PrestamoModel } from '../models/prestamo.model';
import { ResultadoModel } from '../models/resultado.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class PrestamoService {
  private url: string = 'http://localhost:8000/api/prestamos/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getPrestamos(
    estado: string,
    idSede: number | null,
    busqueda: string,
  ): Observable<PrestamoModel[]> {
    let parametros = new HttpParams();
    if (estado !== '') {
      parametros = parametros.set('estado', estado);
    }
    if (idSede !== null) {
      parametros = parametros.set('id_sede', String(idSede));
    }
    if (busqueda !== '') {
      parametros = parametros.set('q', busqueda);
    }
    return this.http
      .get<unknown>(this.url, { headers: this.auth.getHeaders(), params: parametros })
      .pipe(map((respuesta) => this.aPrestamos(respuesta)));
  }

  public getPrestamo(idPrestamo: number): Observable<PrestamoDetalleModel> {
    return this.http
      .get<unknown>(this.url + idPrestamo + '/', { headers: this.auth.getHeaders() })
      .pipe(
        map((respuesta) => {
          const d = this.datos.objeto(respuesta);
          if (d === null) {
            throw this.datos.error();
          }
          const valorMultaEstimado = this.datos.numero(d['valor_multa_estimado']);
          if (valorMultaEstimado === null) {
            throw this.datos.error();
          }
          const multa = this.datos.objeto(d['multa']);
          return {
            prestamo: this.aPrestamo(d),
            valorMultaEstimado: valorMultaEstimado,
            multaEstado: multa === null ? null : this.datos.texto(multa['estado']),
            multaValor: multa === null ? null : this.datos.numero(multa['valor']),
          };
        }),
      );
  }

  public registrarPrestamo(idSocio: number, idEjemplar: number): Observable<ResultadoModel> {
    const cuerpo = { id_socio: idSocio, id_ejemplar: idEjemplar };
    return this.http
      .post<unknown>(this.url, cuerpo, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, 'p_id_prestamo')));
  }

  public registrarDevolucion(idPrestamo: number): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(
        this.url + idPrestamo + '/devolucion/',
        {},
        { headers: this.auth.getHeaders() },
      )
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public renovarPrestamo(idPrestamo: number): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(
        this.url + idPrestamo + '/renovacion/',
        {},
        { headers: this.auth.getHeaders() },
      )
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public aPrestamos(valor: unknown): PrestamoModel[] {
    if (!Array.isArray(valor)) {
      throw this.datos.error();
    }
    const prestamos: PrestamoModel[] = [];
    for (const elemento of valor) {
      prestamos.push(this.aPrestamo(elemento));
    }
    return prestamos;
  }

  private aPrestamo(valor: unknown): PrestamoModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idPrestamo = this.datos.numero(d['id_prestamo']);
    const idSocio = this.datos.numero(d['id_socio']);
    const socio = this.datos.texto(d['socio']);
    const numeroDocumento = this.datos.texto(d['numero_documento']);
    const idLibro = this.datos.numero(d['id_libro']);
    const titulo = this.datos.texto(d['titulo']);
    const codigoBarras = this.datos.texto(d['codigo_barras']);
    const sedePrestamo = this.datos.texto(d['sede_prestamo']);
    const fechaPrestamo = this.datos.texto(d['fecha_prestamo']);
    const fechaLimite = this.datos.texto(d['fecha_limite']);
    const numRenovaciones = this.datos.numero(d['num_renovaciones']);
    const estado = this.datos.texto(d['estado']);
    const diasRetraso = this.datos.numero(d['dias_retraso']);
    const registradoPor = this.datos.texto(d['registrado_por']);
    if (
      idPrestamo === null ||
      idSocio === null ||
      socio === null ||
      numeroDocumento === null ||
      idLibro === null ||
      titulo === null ||
      codigoBarras === null ||
      sedePrestamo === null ||
      fechaPrestamo === null ||
      fechaLimite === null ||
      numRenovaciones === null ||
      estado === null ||
      diasRetraso === null ||
      registradoPor === null
    ) {
      throw this.datos.error();
    }
    return {
      idPrestamo: idPrestamo,
      idSocio: idSocio,
      socio: socio,
      numeroDocumento: numeroDocumento,
      idLibro: idLibro,
      titulo: titulo,
      codigoBarras: codigoBarras,
      sedePrestamo: sedePrestamo,
      sedeDevolucion: this.datos.texto(d['sede_devolucion']),
      fechaPrestamo: fechaPrestamo,
      fechaLimite: fechaLimite,
      fechaDevolucion: this.datos.texto(d['fecha_devolucion']),
      numRenovaciones: numRenovaciones,
      estado: estado,
      diasRetraso: diasRetraso,
      registradoPor: registradoPor,
    };
  }
}
