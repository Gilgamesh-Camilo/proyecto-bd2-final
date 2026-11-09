export interface MultaModel {
  idPrestamo: number;
  motivo: string;
  valor: number;
  estado: string;
  fechaGeneracion: string;
  fechaPago: string | null;
  idSocio: number;
  socio: string;
  numeroDocumento: string;
  titulo: string;
}
