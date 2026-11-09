import { AutorModel } from './autor.model';
import { CalificacionModel } from './calificacion.model';
import { EjemplarModel } from './ejemplar.model';
import { FichaModel } from './ficha.model';

export interface LibroDetalleModel {
  idLibro: number;
  isbn: string;
  titulo: string;
  subtitulo: string | null;
  anioPublicacion: number | null;
  edicion: number;
  numeroPaginas: number | null;
  idioma: string;
  categoria: string;
  codigoDewey: string;
  editorial: string;
  paisEditorial: string | null;
  autores: AutorModel[];
  ejemplares: EjemplarModel[];
  ficha: FichaModel | null;
  calificacion: CalificacionModel | null;
}
