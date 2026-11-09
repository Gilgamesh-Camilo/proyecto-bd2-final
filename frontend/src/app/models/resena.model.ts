export interface ResenaModel {
  id: string;
  idSocio: number | null;
  socio: string;
  calificacion: number;
  titulo: string;
  texto: string;
  fecha: string;
  editada: boolean;
  votosUtiles: number;
}
