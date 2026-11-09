import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { EmpleadoModel } from '../../models/empleado.model';
import { PanelModel } from '../../models/panel.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';

@Component({
  selector: 'app-panelcomponent',
  standalone: false,
  styleUrl: './panelcomponent.css',
  templateUrl: './panelcomponent.html',
})
export class Panelcomponent implements OnInit {
  empleado: EmpleadoModel | null = null;
  panel: PanelModel | null = null;
  cargando: boolean = true;
  error: string = '';
  puedeMantener: boolean = false;
  actualizando: boolean = false;
  mensajeMantenimiento: string = '';
  errorMantenimiento: string = '';

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.empleado = this.auth.getEmpleado();
    this.puedeMantener = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.catalogoService.getPanel().subscribe({
      next: (panel) => {
        this.panel = panel;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  actualizarEstados(): void {
    if (!this.puedeMantener) {
      this.errorMantenimiento = 'Tu rol no puede ejecutar el mantenimiento.';
      return;
    }
    this.actualizando = true;
    this.mensajeMantenimiento = '';
    this.errorMantenimiento = '';
    this.catalogoService.actualizarEstados().subscribe({
      next: (resultado) => {
        this.mensajeMantenimiento = resultado.mensaje;
        this.actualizando = false;
        this.cargar();
      },
      error: (e: unknown) => {
        this.errorMantenimiento = this.auth.mensajeError(e);
        this.actualizando = false;
        this.cdr.markForCheck();
      },
    });
  }
}
