import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuditoriaModel } from '../../models/auditoria.model';
import { AuditoriaService } from '../../services/auditoria.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auditoriacomponent',
  standalone: false,
  styleUrl: './auditoriacomponent.css',
  templateUrl: './auditoriacomponent.html',
})
export class Auditoriacomponent implements OnInit {
  registros: AuditoriaModel[] = [];
  tablas: string[] = [
    'prestamos',
    'multas',
    'reservas',
    'traslados',
    'ejemplares',
    'socios',
    'empleados',
  ];
  tabla: string = '';
  errorTabla: string = '';
  cargando: boolean = true;
  error: string = '';

  constructor(
    private auth: AuthService,
    private auditoriaService: AuditoriaService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  validarTabla(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'Elige una tabla de la lista.';
    }
    if (valor !== '' && this.tablas.indexOf(valor) === -1) {
      return 'Elige una tabla de la lista.';
    }
    return '';
  }

  cargar(): void {
    this.errorTabla = this.validarTabla(this.tabla);
    if (this.errorTabla !== '') {
      return;
    }
    this.cargando = true;
    this.error = '';
    this.auditoriaService.getAuditoria(this.tabla).subscribe({
      next: (registros) => {
        this.registros = registros;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.registros = [];
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }
}
