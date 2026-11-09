export interface SocioRegistroModel {
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  idTipoSocio: number;
}
