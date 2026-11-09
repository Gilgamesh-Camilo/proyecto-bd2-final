import { CategoriaModel } from './categoria.model';
import { SedeModel } from './sede.model';
import { TipoSocioModel } from './tipo-socio.model';

export interface CatalogosModel {
  sedes: SedeModel[];
  categorias: CategoriaModel[];
  tiposSocio: TipoSocioModel[];
}
