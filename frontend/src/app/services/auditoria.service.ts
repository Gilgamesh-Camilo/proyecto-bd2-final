import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuditoriaModel } from '../models/auditoria.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private url: string = 'http://localhost:8000/api/auditoria/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getAuditoria(tabla: string): Observable<AuditoriaModel[]> {
    let parametros = new HttpParams();
    if (tabla !== '') {
      parametros = parametros.set('tabla', tabla);
    }
    return this.http
      .get<unknown>(this.url, { headers: this.auth.getHeaders(), params: parametros })
      .pipe(
        map((respuesta) => {
          if (!Array.isArray(respuesta)) {
            throw this.datos.error();
          }
          const registros: AuditoriaModel[] = [];
          for (const elemento of respuesta) {
            registros.push(this.aRegistro(elemento));
          }
          return registros;
        }),
      );
  }

  private aRegistro(valor: unknown): AuditoriaModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idAuditoria = this.datos.numero(d['id_auditoria']);
    const tablaAfectada = this.datos.texto(d['tabla_afectada']);
    const operacion = this.datos.texto(d['operacion']);
    const claveRegistro = this.datos.texto(d['clave_registro']);
    const usuarioBd = this.datos.texto(d['usuario_bd']);
    const fecha = this.datos.texto(d['fecha']);
    if (
      idAuditoria === null ||
      tablaAfectada === null ||
      operacion === null ||
      claveRegistro === null ||
      usuarioBd === null ||
      fecha === null
    ) {
      throw this.datos.error();
    }
    return {
      idAuditoria: idAuditoria,
      tablaAfectada: tablaAfectada,
      operacion: operacion,
      claveRegistro: claveRegistro,
      usuarioBd: usuarioBd,
      fecha: fecha,
      antes: this.cambios(d['valores_anteriores'], d['valores_nuevos']),
      despues: this.cambios(d['valores_nuevos'], d['valores_anteriores']),
    };
  }

  private cambios(valores: unknown, otros: unknown): string {
    const d = this.aObjeto(valores);
    if (d === null) {
      return '';
    }
    const comparar = this.aObjeto(otros);
    const lineas: string[] = [];
    for (const campo of Object.keys(d)) {
      const actual = JSON.stringify(d[campo]);
      if (comparar === null || actual !== JSON.stringify(comparar[campo])) {
        lineas.push(campo + ': ' + actual);
      }
    }
    return lineas.join('\n');
  }

  private aObjeto(valor: unknown): Record<string, unknown> | null {
    if (typeof valor === 'string') {
      try {
        return this.datos.objeto(JSON.parse(valor));
      } catch {
        return null;
      }
    }
    return this.datos.objeto(valor);
  }
}
