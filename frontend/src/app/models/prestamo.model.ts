export interface PrestamoModel {
  idPrestamo: number;
  idSocio: number;
  socio: string;
  numeroDocumento: string;
  idLibro: number;
  titulo: string;
  codigoBarras: string;
  sedePrestamo: string;
  sedeDevolucion: string | null;
  fechaPrestamo: string;
  fechaLimite: string;
  fechaDevolucion: string | null;
  numRenovaciones: number;
  estado: string;
  diasRetraso: number;
  registradoPor: string;
}
