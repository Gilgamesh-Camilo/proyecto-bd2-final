import { ConteoModel } from './conteo.model';

export interface EstadisticasModel {
  prestamosPorSede: ConteoModel[];
  librosMasPrestados: ConteoModel[];
  mejorCalificados: ConteoModel[];
  resenasPorCategoria: ConteoModel[];
  busquedasSinResultado: ConteoModel[];
  terminosMasBuscados: ConteoModel[];
}
