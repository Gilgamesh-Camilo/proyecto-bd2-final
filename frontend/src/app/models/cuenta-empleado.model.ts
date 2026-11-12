export interface CuentaEmpleadoModel {
  idEmpleado: number;
  usuario: string;
  nombres: string;
  apellidos: string;
  rol: string;
  sede: string;
  estado: string;
  intentosFallidos: number;
  ultimoAcceso: string | null;
}
