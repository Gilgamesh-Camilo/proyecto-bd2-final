import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ConteoModel } from '../models/conteo.model';
import { EstadisticasModel } from '../models/estadisticas.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class EstadisticaService {
  private url: string = 'http://localhost:8000/api/estadisticas/';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getEstadisticas(): Observable<EstadisticasModel> {
    return this.http.get<unknown>(this.url, { headers: this.auth.getHeaders() }).pipe(
      map((respuesta) => {
        const d = this.datos.objeto(respuesta);
        if (d === null) {
          throw this.datos.error();
        }
        const prestamosPorSede: ConteoModel[] = [];
        for (const elemento of this.datos.lista(d['prestamos_por_sede'])) {
          const fila = this.fila(elemento);
          const otraSede = this.numero(fila['devueltos_en_otra_sede']);
          prestamosPorSede.push({
            etiqueta: this.texto(fila['sede']),
            valor: this.numero(fila['prestamos']),
            detalle:
              otraSede === 1 ? '1 devuelto en otra sede' : otraSede + ' devueltos en otra sede',
          });
        }
        const librosMasPrestados: ConteoModel[] = [];
        for (const elemento of this.datos.lista(d['libros_mas_prestados'])) {
          const fila = this.fila(elemento);
          librosMasPrestados.push({
            etiqueta: this.texto(fila['titulo']),
            valor: this.numero(fila['prestamos']),
            detalle: '',
          });
        }
        const mejorCalificados: ConteoModel[] = [];
        for (const elemento of this.datos.lista(d['mejor_calificados'])) {
          const fila = this.fila(elemento);
          const categoria = this.datos.texto(fila['categoria']);
          mejorCalificados.push({
            etiqueta: this.texto(fila['titulo']),
            valor: Math.round(this.numero(fila['promedio']) * 100) / 100,
            detalle:
              (categoria === null ? '' : categoria + ', ') +
              this.numero(fila['total']) +
              ' reseñas',
          });
        }
        const resenasPorCategoria: ConteoModel[] = [];
        for (const elemento of this.datos.lista(d['resenas_por_categoria'])) {
          const fila = this.fila(elemento);
          resenasPorCategoria.push({
            etiqueta: this.texto(fila['categoria']),
            valor: this.numero(fila['total']),
            detalle: 'promedio ' + this.decimal(this.numero(fila['promedio'])),
          });
        }
        const busquedasSinResultado: ConteoModel[] = [];
        for (const elemento of this.datos.lista(d['busquedas_sin_resultado'])) {
          const fila = this.fila(elemento);
          const sedes = this.datos.lista(fila['sedes']).length;
          busquedasSinResultado.push({
            etiqueta: this.texto(fila['termino']),
            valor: this.numero(fila['veces']),
            detalle: sedes === 1 ? 'en 1 sede' : 'en ' + sedes + ' sedes',
          });
        }
        const terminosMasBuscados: ConteoModel[] = [];
        for (const elemento of this.datos.lista(d['terminos_mas_buscados'])) {
          const fila = this.fila(elemento);
          terminosMasBuscados.push({
            etiqueta: this.texto(fila['termino']),
            valor: this.numero(fila['veces']),
            detalle: this.numero(fila['con_resultado']) + ' con resultados',
          });
        }
        return {
          prestamosPorSede: prestamosPorSede,
          librosMasPrestados: librosMasPrestados,
          mejorCalificados: mejorCalificados,
          resenasPorCategoria: resenasPorCategoria,
          busquedasSinResultado: busquedasSinResultado,
          terminosMasBuscados: terminosMasBuscados,
        };
      }),
    );
  }

  private fila(valor: unknown): Record<string, unknown> {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    return d;
  }

  private texto(valor: unknown): string {
    const texto = this.datos.texto(valor);
    if (texto === null) {
      throw this.datos.error();
    }
    return texto;
  }

  private numero(valor: unknown): number {
    const numero = this.datos.numero(valor);
    if (numero === null) {
      throw this.datos.error();
    }
    return numero;
  }

  private decimal(valor: number): string {
    return valor.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  }
}
