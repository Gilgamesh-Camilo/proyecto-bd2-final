import { AutorRegistroModel } from './autor-registro.model';
import { EjemplarRegistroModel } from './ejemplar-registro.model';

export interface LibroRegistroModel {
  isbn: string;
  titulo: string;
  subtitulo: string | null;
  anioPublicacion: number | null;
  edicion: number;
  numeroPaginas: number | null;
  idioma: string;
  idEditorial: number;
  idCategoria: number;
  autores: AutorRegistroModel[];
  sinopsis: string | null;
  palabrasClave: string[];
  ejemplares: EjemplarRegistroModel;
}
