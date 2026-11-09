export interface ReservaModel {
  idReserva: number;
  idSocio: number;
  socio: string;
  numeroDocumento: string;
  idLibro: number;
  titulo: string;
  sedeRetiro: string;
  codigoBarras: string | null;
  fechaReserva: string;
  fechaExpiracion: string | null;
  estado: string;
}
