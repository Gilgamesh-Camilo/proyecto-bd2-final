import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CatalogosModel } from '../models/catalogos.model';
import { CategoriaModel } from '../models/categoria.model';
import { EstadoServidorModel } from '../models/estado-servidor.model';
import { PanelModel } from '../models/panel.model';
import { ResultadoModel } from '../models/resultado.model';
import { SedeModel } from '../models/sede.model';
import { TipoSocioModel } from '../models/tipo-socio.model';
import { VencidoModel } from '../models/vencido.model';
import { AuthService } from './auth.service';
import { DatosService } from './datos.service';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private url: string = 'http://localhost:8000/api';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private datos: DatosService,
  ) {}

  public getEstadoServidor(): Observable<EstadoServidorModel> {
    return this.http.get<unknown>(this.url + '/status/').pipe(
      map((respuesta) => {
        const d = this.datos.objeto(respuesta);
        const conexiones = d === null ? null : this.datos.objeto(d['conexiones']);
        if (conexiones === null) {
          throw this.datos.error();
        }
        return {
          operacion: conexiones['postgresql'] === true,
          fichas: conexiones['mongodb'] === true,
        };
      }),
    );
  }

  public getCatalogos(): Observable<CatalogosModel> {
    return this.http
      .get<unknown>(this.url + '/catalogos/', { headers: this.auth.getHeaders() })
      .pipe(
        map((respuesta) => {
          const d = this.datos.objeto(respuesta);
          if (d === null) {
            throw this.datos.error();
          }
          const sedes: SedeModel[] = [];
          for (const elemento of this.datos.lista(d['sedes'])) {
            sedes.push(this.aSede(elemento));
          }
          const categorias: CategoriaModel[] = [];
          for (const elemento of this.datos.lista(d['categorias'])) {
            categorias.push(this.aCategoria(elemento));
          }
          const tiposSocio: TipoSocioModel[] = [];
          for (const elemento of this.datos.lista(d['tipos_socio'])) {
            tiposSocio.push(this.aTipoSocio(elemento));
          }
          return { sedes: sedes, categorias: categorias, tiposSocio: tiposSocio };
        }),
      );
  }

  public getPanel(): Observable<PanelModel> {
    return this.http.get<unknown>(this.url + '/panel/', { headers: this.auth.getHeaders() }).pipe(
      map((respuesta) => {
        const d = this.datos.objeto(respuesta);
        const r = d === null ? null : this.datos.objeto(d['resumen']);
        if (d === null || r === null) {
          throw this.datos.error();
        }
        const vencidos: VencidoModel[] = [];
        for (const elemento of this.datos.lista(d['vencidos_mi_sede'])) {
          vencidos.push(this.aVencido(elemento));
        }
        return {
          prestamosAlDia: this.cantidad(r['prestamos_al_dia']),
          prestamosVencidos: this.cantidad(r['prestamos_vencidos']),
          multasPendientes: this.cantidad(r['multas_pendientes']),
          valorMultasPendientes: this.cantidad(r['valor_multas_pendientes']),
          reservasEnEspera: this.cantidad(r['reservas_en_espera']),
          reservasParaRetirar: this.cantidad(r['reservas_para_retirar']),
          trasladosAbiertos: this.cantidad(r['traslados_abiertos']),
          disponiblesEnMiSede: this.cantidad(r['disponibles_en_mi_sede']),
          vencidosMiSede: vencidos,
        };
      }),
    );
  }

  public actualizarEstados(): Observable<ResultadoModel> {
    return this.http
      .post<unknown>(this.url + '/mantenimiento/estados/', {}, { headers: this.auth.getHeaders() })
      .pipe(map((respuesta) => this.datos.resultado(respuesta, '')));
  }

  private cantidad(valor: unknown): number {
    const numero = this.datos.numero(valor);
    if (numero === null) {
      throw this.datos.error();
    }
    return numero;
  }

  private aSede(valor: unknown): SedeModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idSede = this.datos.numero(d['id_sede']);
    const nombre = this.datos.texto(d['nombre']);
    const ciudad = this.datos.texto(d['ciudad']);
    const estado = this.datos.texto(d['estado']);
    if (idSede === null || nombre === null || ciudad === null || estado === null) {
      throw this.datos.error();
    }
    return { idSede: idSede, nombre: nombre, ciudad: ciudad, estado: estado };
  }

  private aCategoria(valor: unknown): CategoriaModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idCategoria = this.datos.numero(d['id_categoria']);
    const codigoDewey = this.datos.texto(d['codigo_dewey']);
    const nombre = this.datos.texto(d['nombre']);
    if (idCategoria === null || codigoDewey === null || nombre === null) {
      throw this.datos.error();
    }
    return { idCategoria: idCategoria, codigoDewey: codigoDewey, nombre: nombre };
  }

  private aTipoSocio(valor: unknown): TipoSocioModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idTipoSocio = this.datos.numero(d['id_tipo_socio']);
    const nombre = this.datos.texto(d['nombre']);
    const maxPrestamos = this.datos.numero(d['max_prestamos']);
    const diasPrestamo = this.datos.numero(d['dias_prestamo']);
    const maxRenovaciones = this.datos.numero(d['max_renovaciones']);
    const valorMultaDia = this.datos.numero(d['valor_multa_dia']);
    if (
      idTipoSocio === null ||
      nombre === null ||
      maxPrestamos === null ||
      diasPrestamo === null ||
      maxRenovaciones === null ||
      valorMultaDia === null
    ) {
      throw this.datos.error();
    }
    return {
      idTipoSocio: idTipoSocio,
      nombre: nombre,
      maxPrestamos: maxPrestamos,
      diasPrestamo: diasPrestamo,
      maxRenovaciones: maxRenovaciones,
      valorMultaDia: valorMultaDia,
    };
  }

  private aVencido(valor: unknown): VencidoModel {
    const d = this.datos.objeto(valor);
    if (d === null) {
      throw this.datos.error();
    }
    const idPrestamo = this.datos.numero(d['id_prestamo']);
    const titulo = this.datos.texto(d['titulo']);
    const codigoBarras = this.datos.texto(d['codigo_barras']);
    const socio = this.datos.texto(d['socio']);
    const fechaLimite = this.datos.texto(d['fecha_limite']);
    const diasRetraso = this.datos.numero(d['dias_retraso']);
    if (
      idPrestamo === null ||
      titulo === null ||
      codigoBarras === null ||
      socio === null ||
      fechaLimite === null ||
      diasRetraso === null
    ) {
      throw this.datos.error();
    }
    return {
      idPrestamo: idPrestamo,
      titulo: titulo,
      codigoBarras: codigoBarras,
      socio: socio,
      fechaLimite: fechaLimite,
      diasRetraso: diasRetraso,
    };
  }
}
