import { ListaLecturaModel } from './lista-lectura.model';
import { MultaModel } from './multa.model';
import { PrestamoModel } from './prestamo.model';
import { ReservaModel } from './reserva.model';
import { SocioModel } from './socio.model';

export interface SocioDetalleModel {
  socio: SocioModel;
  fechaNacimiento: string;
  direccion: string | null;
  fechaRegistro: string;
  fechaExpedicion: string | null;
  fechaVencimiento: string | null;
  maxPrestamos: number;
  diasPrestamo: number;
  valorMultaDia: number;
  prestamos: PrestamoModel[];
  multas: MultaModel[];
  reservas: ReservaModel[];
  listasLectura: ListaLecturaModel[] | null;
}
