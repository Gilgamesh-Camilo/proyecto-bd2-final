import { Injectable } from '@angular/core';
import { ResultadoModel } from '../models/resultado.model';

@Injectable({ providedIn: 'root' })
export class DatosService {
  public objeto(valor: unknown): Record<string, unknown> | null {
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      return null;
    }
    return valor as Record<string, unknown>;
  }

  public lista(valor: unknown): unknown[] {
    if (!Array.isArray(valor)) {
      return [];
    }
    return valor;
  }

  public texto(valor: unknown): string | null {
    if (typeof valor !== 'string') {
      return null;
    }
    return valor;
  }

  public numero(valor: unknown): number | null {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      return null;
    }
    return valor;
  }

  public textos(valor: unknown): string[] {
    const resultado: string[] = [];
    for (const elemento of this.lista(valor)) {
      if (typeof elemento === 'string') {
        resultado.push(elemento);
      }
    }
    return resultado;
  }

  public resultado(valor: unknown, campoId: string): ResultadoModel {
    const d = this.objeto(valor);
    if (d === null) {
      throw new Error('La respuesta del servidor no es válida.');
    }
    let mensaje = this.texto(d['p_mensaje']);
    if (mensaje === null) {
      mensaje = this.texto(d['mensaje']);
    }
    if (mensaje === null) {
      throw new Error('La respuesta del servidor no es válida.');
    }
    let id: number | null = null;
    if (campoId !== '') {
      id = this.numero(d[campoId]);
    }
    return { mensaje: mensaje, id: id };
  }

  public error(): Error {
    return new Error('La respuesta del servidor no es válida.');
  }

  public mensajeNavegacion(): string {
    try {
      const estado = this.objeto(history.state);
      if (estado === null) {
        return '';
      }
      const mensaje = this.texto(estado['mensaje']);
      return mensaje === null ? '' : mensaje;
    } catch {
      return '';
    }
  }
}
