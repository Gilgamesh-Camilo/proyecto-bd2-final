export interface TrasladoModel {
  idTraslado: number;
  codigoBarras: string;
  titulo: string;
  idSedeOrigen: number;
  sedeOrigen: string;
  idSedeDestino: number;
  sedeDestino: string;
  solicitadoPor: string;
  fechaSolicitud: string;
  fechaEnvio: string | null;
  fechaRecepcion: string | null;
  estado: string;
  motivo: string | null;
}
