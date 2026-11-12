export interface SedeDetalleModel {
  idSede: number;
  nombre: string;
  direccion: string;
  ciudad: string;
  telefono: string | null;
  fechaApertura: string | null;
  estado: string;
  ejemplares: number;
  empleados: number;
}
