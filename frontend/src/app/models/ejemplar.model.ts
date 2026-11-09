export interface EjemplarModel {
  idEjemplar: number;
  codigoBarras: string;
  estado: string;
  ubicacionEstante: string | null;
  idSede: number;
  sede: string;
}
