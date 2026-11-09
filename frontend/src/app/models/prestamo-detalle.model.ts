import { PrestamoModel } from './prestamo.model';

export interface PrestamoDetalleModel {
  prestamo: PrestamoModel;
  valorMultaEstimado: number;
  multaEstado: string | null;
  multaValor: number | null;
}
