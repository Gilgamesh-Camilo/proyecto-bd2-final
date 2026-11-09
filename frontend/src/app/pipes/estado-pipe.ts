import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'estado',
  standalone: false,
})
export class EstadoPipe implements PipeTransform {
  private nombres: Record<string, string> = {
    ACTIVO: 'Activo',
    ACTIVA: 'Activa',
    CERRADA: 'Cerrada',
    INACTIVO: 'Inactivo',
    SUSPENDIDO: 'Suspendido',
    BLOQUEADO: 'Bloqueado',
    RETIRADO: 'Retirado',
    ANULADO: 'Anulado',
    VIGENTE: 'Vigente',
    VENCIDO: 'Vencido',
    DEVUELTO: 'Devuelto',
    PERDIDO: 'Perdido',
    DISPONIBLE: 'Disponible',
    PRESTADO: 'Prestado',
    RESERVADO: 'Reservado',
    EN_TRASLADO: 'En traslado',
    EN_REPARACION: 'En reparación',
    DE_BAJA: 'De baja',
    PENDIENTE: 'Pendiente',
    PAGADA: 'Pagada',
    CONDONADA: 'Condonada',
    EN_ESPERA: 'En espera',
    ATENDIDA: 'Atendida',
    CANCELADA: 'Cancelada',
    EXPIRADA: 'Expirada',
    SOLICITADO: 'Solicitado',
    EN_TRANSITO: 'En tránsito',
    RECIBIDO: 'Recibido',
    CANCELADO: 'Cancelado',
    RETRASO: 'Retraso',
    PERDIDA: 'Pérdida',
    DANO: 'Daño',
    INSERT: 'Inserción',
    UPDATE: 'Modificación',
    ADMINISTRADOR: 'Administrador',
    BIBLIOTECARIO: 'Bibliotecario',
    AUXILIAR: 'Auxiliar',
    DELETE: 'Borrado',
  };

  transform(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    const nombre = this.nombres[value];
    if (typeof nombre === 'string') {
      return nombre;
    }
    return value;
  }
}
