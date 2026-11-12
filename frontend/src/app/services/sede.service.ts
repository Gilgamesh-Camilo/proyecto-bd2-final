import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ResultadoModel } from '../models/resultado.model';
import { SedeDetalleModel } from '../models/sede-detalle.model';
import { SedeRegistroModel } from '../models/sede-registro.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class SedeService {
  private url: string = 'http://localhost:8000/api/sedes/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getSedes(): Observable<SedeDetalleModel[]> {
    return this.http.get<unknown>(this.url, { headers: this.auth.getHeaders() }).pipe(
      map((respuesta) => {
        if (!Array.isArray(respuesta)) {
          throw this.datos.error();
        }
        const sedes: SedeDetalleModel[] = [];
        for (const elemento of respuesta) {
          sedes.push(this.aSede(elemento));
        }
        return sedes;
      }),
    );
  }

  public registrarSede(sede: SedeRegistroModel): Observable<ResultadoModel> {
    const cuerpo = {
      nombre: sede.nombre,
      direccion: sede.direccion,
      ciudad: sede.ciudad,
      telefono: sede.telefono,
      fecha_apertura: sede.fechaApertura,
    };
    return this.http
      .post<unknown>(this.url, cuerpo, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, 'p_id_sede')));
  }

  public cambiarEstado(idSede: number, estado: string): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(
        this.url + idSede + '/estado/',
        { estado: estado },
        { headers: this.auth.getHeaders() },
      )
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  private aSede(valor: unknown): SedeDetalleModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idSede = this.datos.numero(d['id_sede']);
    const nombre = this.datos.texto(d['nombre']);
    const direccion = this.datos.texto(d['direccion']);
    const ciudad = this.datos.texto(d['ciudad']);
    const estado = this.datos.texto(d['estado']);
    const ejemplares = this.datos.numero(d['ejemplares']);
    const empleados = this.datos.numero(d['empleados']);
    if (
      idSede === null ||
      nombre === null ||
      direccion === null ||
      ciudad === null ||
      estado === null ||
      ejemplares === null ||
      empleados === null
    ) {
      throw this.datos.error();
    }
    return {
      idSede: idSede,
      nombre: nombre,
      direccion: direccion,
      ciudad: ciudad,
      telefono: this.datos.texto(d['telefono']),
      fechaApertura: this.datos.texto(d['fecha_apertura']),
      estado: estado,
      ejemplares: ejemplares,
      empleados: empleados,
    };
  }
}
