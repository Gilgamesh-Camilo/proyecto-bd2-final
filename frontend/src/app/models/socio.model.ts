export interface SocioModel {
  idSocio: number;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  tipoSocio: string;
  estado: string;
  numeroCarne: string | null;
  estadoCarne: string | null;
  prestamosAbiertos: number;
  multasPendientes: number;
  motivoBloqueo: string | null;
}
