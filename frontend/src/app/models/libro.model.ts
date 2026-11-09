import { DisponibilidadSedeModel } from './disponibilidad-sede.model';

export interface LibroModel {
  idLibro: number;
  isbn: string;
  titulo: string;
  subtitulo: string | null;
  anioPublicacion: number | null;
  idioma: string;
  categoria: string;
  editorial: string;
  autores: string;
  totalEjemplares: number;
  disponibles: number;
  porSede: DisponibilidadSedeModel[];
}
