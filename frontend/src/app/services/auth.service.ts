import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { EmpleadoModel } from '../models/empleado.model';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private url: string = 'http://localhost:8000/api/auth';
  private claveToken: string = 'bibliored.token';
  private claveEmpleado: string = 'bibliored.empleado';

  constructor(
    private http: HttpClient,
    private router: Router,
    private datos: DatosService,
  ) {}

  public iniciarSesion(usuario: string, contrasena: string): Observable<EmpleadoModel> {
    const cuerpo = { usuario: usuario, contrasena: contrasena };
    return this.http.post<unknown>(this.url + '/login/', cuerpo).pipe(
      map((respuesta) => {
        const datos = this.datos.objeto(respuesta);
        if (datos === null) {
          throw this.datos.error();
        }
        const token = this.datos.texto(datos['token']);
        const empleado = this.aEmpleado(datos['empleado']);
        if (token === null || empleado === null) {
          throw this.datos.error();
        }
        this.guardarSesion(token, empleado);
        return empleado;
      }),
    );
  }

  public cerrarSesion(): void {
    try {
      sessionStorage.removeItem(this.claveToken);
      sessionStorage.removeItem(this.claveEmpleado);
    } catch {
      return;
    } finally {
      this.router.navigate(['/login']);
    }
  }

  public estaAutenticado(): boolean {
    return this.getToken() !== null && this.getEmpleado() !== null;
  }

  public getEmpleado(): EmpleadoModel | null {
    let guardado: string | null = null;
    try {
      guardado = sessionStorage.getItem(this.claveEmpleado);
    } catch {
      return null;
    }
    if (guardado === null) {
      return null;
    }
    try {
      return this.aEmpleado(JSON.parse(guardado));
    } catch {
      return null;
    }
  }

  public tieneRol(roles: string[]): boolean {
    const empleado = this.getEmpleado();
    if (empleado === null) {
      return false;
    }
    for (const rol of roles) {
      if (empleado.rol === rol) {
        return true;
      }
    }
    return false;
  }

  public getHeaders(): HttpHeaders {
    const token = this.getToken();
    if (token === null) {
      return new HttpHeaders();
    }
    return new HttpHeaders({ Authorization: 'Bearer ' + token });
  }

  public mensajeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No se pudo conectar con el servidor. Revisa que el backend esté encendido.';
      }
      if (error.status === 401 && this.estaAutenticado()) {
        this.cerrarSesion();
        return 'La sesión venció. Vuelve a iniciar sesión.';
      }
      const cuerpo = this.datos.objeto(error.error);
      if (cuerpo !== null) {
        const mensaje = this.datos.texto(cuerpo['error']);
        if (mensaje !== null) {
          return mensaje;
        }
      }
      return 'El servidor respondió con un error (' + error.status + ').';
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Ocurrió un error inesperado.';
  }

  private aEmpleado(valor: unknown): EmpleadoModel | null {
    const d = this.datos.objeto(valor);
    if (d === null) {
      return null;
    }
    const idEmpleado = this.datos.numero(
      d['id_empleado'] !== undefined ? d['id_empleado'] : d['idEmpleado'],
    );
    const usuario = this.datos.texto(d['usuario']);
    const nombres = this.datos.texto(d['nombres']);
    const apellidos = this.datos.texto(d['apellidos']);
    const rol = this.datos.texto(d['rol']);
    const idSede = this.datos.numero(d['id_sede'] !== undefined ? d['id_sede'] : d['idSede']);
    const sede = this.datos.texto(d['sede']);
    if (
      idEmpleado === null ||
      usuario === null ||
      nombres === null ||
      apellidos === null ||
      rol === null ||
      idSede === null ||
      sede === null
    ) {
      return null;
    }
    return {
      idEmpleado: idEmpleado,
      usuario: usuario,
      nombres: nombres,
      apellidos: apellidos,
      rol: rol,
      idSede: idSede,
      sede: sede,
    };
  }

  private getToken(): string | null {
    try {
      return sessionStorage.getItem(this.claveToken);
    } catch {
      return null;
    }
  }

  private guardarSesion(token: string, empleado: EmpleadoModel): void {
    try {
      sessionStorage.setItem(this.claveToken, token);
      sessionStorage.setItem(this.claveEmpleado, JSON.stringify(empleado));
    } catch {
      throw new Error('El navegador no permite guardar la sesión.');
    }
  }
}
