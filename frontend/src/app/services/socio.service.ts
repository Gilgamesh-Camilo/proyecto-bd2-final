import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ListaLecturaModel } from '../models/lista-lectura.model';
import { ResultadoModel } from '../models/resultado.model';
import { SocioDetalleModel } from '../models/socio-detalle.model';
import { SocioModel } from '../models/socio.model';
import { SocioRegistroModel } from '../models/socio-registro.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';
import { MultaService } from './multa.service';
import { PrestamoService } from './prestamo.service';
import { ReservaService } from './reserva.service';

@Injectable({ providedIn: 'root' })
export class SocioService {
  private url: string = 'http://localhost:8000/api/socios/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
    private prestamoService: PrestamoService,
    private multaService: MultaService,
    private reservaService: ReservaService,
  ) {}

  public buscarSocios(termino: string): Observable<SocioModel[]> {
    let parametros = new HttpParams();
    if (termino !== '') {
      parametros = parametros.set('q', termino);
    }
    return this.http
      .get<unknown>(this.url, { headers: this.auth.getHeaders(), params: parametros })
      .pipe(map((respuesta) => this.aSocios(respuesta)));
  }

  public getPorDocumento(documento: string): Observable<SocioModel | null> {
    const parametros = new HttpParams().set('documento', documento);
    return this.http
      .get<unknown>(this.url, { headers: this.auth.getHeaders(), params: parametros })
      .pipe(
        map((respuesta) => {
          const socios = this.aSocios(respuesta);
          if (socios.length === 0) {
            return null;
          }
          return socios[0];
        }),
      );
  }

  public getSocio(idSocio: number): Observable<SocioDetalleModel> {
    return this.http
      .get<unknown>(this.url + idSocio + '/', { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.aSocioDetalle(respuesta)));
  }

  public registrarSocio(socio: SocioRegistroModel): Observable<ResultadoModel> {
    const cuerpo = {
      tipo_documento: socio.tipoDocumento,
      numero_documento: socio.numeroDocumento,
      nombres: socio.nombres,
      apellidos: socio.apellidos,
      fecha_nacimiento: socio.fechaNacimiento,
      email: socio.email,
      telefono: socio.telefono,
      direccion: socio.direccion,
      id_tipo_socio: socio.idTipoSocio,
    };
    return this.http
      .post<unknown>(this.url, cuerpo, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, 'p_id_socio')));
  }

  public cambiarEstado(idSocio: number, estado: string): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(
        this.url + idSocio + '/estado/',
        { estado: estado },
        { headers: this.auth.getHeaders() },
      )
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  public renovarCarne(idSocio: number): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(this.url + idSocio + '/carne/', {}, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  private aSocios(valor: unknown): SocioModel[] {
    if (!Array.isArray(valor)) {
      throw this.datos.error();
    }
    const socios: SocioModel[] = [];
    for (const elemento of valor) {
      socios.push(this.aSocio(elemento));
    }
    return socios;
  }

  private aSocio(valor: unknown): SocioModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idSocio = this.datos.numero(d['id_socio']);
    const tipoDocumento = this.datos.texto(d['tipo_documento']);
    const numeroDocumento = this.datos.texto(d['numero_documento']);
    const nombres = this.datos.texto(d['nombres']);
    const apellidos = this.datos.texto(d['apellidos']);
    const tipoSocio = this.datos.texto(d['tipo_socio']);
    const estado = this.datos.texto(d['estado']);
    const prestamosAbiertos = this.datos.numero(d['prestamos_abiertos']);
    const multasPendientes = this.datos.numero(d['multas_pendientes']);
    if (
      idSocio === null ||
      tipoDocumento === null ||
      numeroDocumento === null ||
      nombres === null ||
      apellidos === null ||
      tipoSocio === null ||
      estado === null ||
      prestamosAbiertos === null ||
      multasPendientes === null
    ) {
      throw this.datos.error();
    }
    return {
      idSocio: idSocio,
      tipoDocumento: tipoDocumento,
      numeroDocumento: numeroDocumento,
      nombres: nombres,
      apellidos: apellidos,
      email: this.datos.texto(d['email']),
      telefono: this.datos.texto(d['telefono']),
      tipoSocio: tipoSocio,
      estado: estado,
      numeroCarne: this.datos.texto(d['numero_carne']),
      estadoCarne: this.datos.texto(d['estado_carne']),
      prestamosAbiertos: prestamosAbiertos,
      multasPendientes: multasPendientes,
      motivoBloqueo: this.datos.texto(d['motivo_bloqueo']),
    };
  }

  private aSocioDetalle(valor: unknown): SocioDetalleModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const fechaNacimiento = this.datos.texto(d['fecha_nacimiento']);
    const fechaRegistro = this.datos.texto(d['fecha_registro']);
    const maxPrestamos = this.datos.numero(d['max_prestamos']);
    const diasPrestamo = this.datos.numero(d['dias_prestamo']);
    const valorMultaDia = this.datos.numero(d['valor_multa_dia']);
    if (
      fechaNacimiento === null ||
      fechaRegistro === null ||
      maxPrestamos === null ||
      diasPrestamo === null ||
      valorMultaDia === null
    ) {
      throw this.datos.error();
    }
    let listas: ListaLecturaModel[] | null = null;
    if (Array.isArray(d['listas_lectura'])) {
      listas = [];
      for (const elemento of d['listas_lectura']) {
        listas.push(this.aLista(elemento));
      }
    }
    return {
      socio: this.aSocio(d),
      fechaNacimiento: fechaNacimiento,
      direccion: this.datos.texto(d['direccion']),
      fechaRegistro: fechaRegistro,
      fechaExpedicion: this.datos.texto(d['fecha_expedicion']),
      fechaVencimiento: this.datos.texto(d['fecha_vencimiento']),
      maxPrestamos: maxPrestamos,
      diasPrestamo: diasPrestamo,
      valorMultaDia: valorMultaDia,
      prestamos: this.prestamoService.aPrestamos(d['prestamos']),
      multas: this.multaService.aMultas(d['multas']),
      reservas: this.reservaService.aReservas(d['reservas']),
      listasLectura: listas,
    };
  }

  private aLista(valor: unknown): ListaLecturaModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const id = this.datos.texto(d['id']);
    const nombre = this.datos.texto(d['nombre']);
    if (id === null || nombre === null) {
      throw this.datos.error();
    }
    const libros: string[] = [];
    let leidos: number = 0;
    for (const elemento of this.datos.lista(d['libros'])) {
      const libro = this.datos.objeto(elemento);
      if (libro !== null) {
        const titulo = this.datos.texto(libro['titulo']);
        if (titulo !== null) {
          libros.push(titulo);
        }
        if (libro['leido'] === true) {
          leidos = leidos + 1;
        }
      }
    }
    return {
      id: id,
      nombre: nombre,
      publica: d['publica'] === true,
      libros: libros,
      leidos: leidos,
    };
  }
}
