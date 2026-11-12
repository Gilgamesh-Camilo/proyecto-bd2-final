import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CuentaEmpleadoModel } from '../models/cuenta-empleado.model';
import { ResultadoModel } from '../models/resultado.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class EmpleadoService {
  private url: string = 'http://localhost:8000/api/empleados/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getEmpleados(): Observable<CuentaEmpleadoModel[]> {
    return this.http.get<unknown>(this.url, { headers: this.auth.getHeaders() }).pipe(
      map((respuesta) => {
        if (!Array.isArray(respuesta)) {
          throw this.datos.error();
        }
        const empleados: CuentaEmpleadoModel[] = [];
        for (const elemento of respuesta) {
          empleados.push(this.aEmpleado(elemento));
        }
        return empleados;
      }),
    );
  }

  public desbloquear(idEmpleado: number): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(
        this.url + idEmpleado + '/desbloqueo/',
        {},
        { headers: this.auth.getHeaders() },
      )
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  private aEmpleado(valor: unknown): CuentaEmpleadoModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idEmpleado = this.datos.numero(d['id_empleado']);
    const usuario = this.datos.texto(d['usuario']);
    const nombres = this.datos.texto(d['nombres']);
    const apellidos = this.datos.texto(d['apellidos']);
    const rol = this.datos.texto(d['rol']);
    const sede = this.datos.texto(d['sede']);
    const estado = this.datos.texto(d['estado']);
    const intentosFallidos = this.datos.numero(d['intentos_fallidos']);
    if (
      idEmpleado === null ||
      usuario === null ||
      nombres === null ||
      apellidos === null ||
      rol === null ||
      sede === null ||
      estado === null ||
      intentosFallidos === null
    ) {
      throw this.datos.error();
    }
    return {
      idEmpleado: idEmpleado,
      usuario: usuario,
      nombres: nombres,
      apellidos: apellidos,
      rol: rol,
      sede: sede,
      estado: estado,
      intentosFallidos: intentosFallidos,
      ultimoAcceso: this.datos.texto(d['ultimo_acceso']),
    };
  }
}
