import { VencidoModel } from './vencido.model';

export interface PanelModel {
  prestamosAlDia: number;
  prestamosVencidos: number;
  multasPendientes: number;
  valorMultasPendientes: number;
  reservasEnEspera: number;
  reservasParaRetirar: number;
  trasladosAbiertos: number;
  disponiblesEnMiSede: number;
  vencidosMiSede: VencidoModel[];
}
