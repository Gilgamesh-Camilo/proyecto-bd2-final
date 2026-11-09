import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { SocioModel } from '../../models/socio.model';
import { AuthService } from '../../services/auth.service';
import { DatosService } from '../../services/datos.service';
import { SocioService } from '../../services/socio.service';

@Component({
  selector: 'app-socioscomponent',
  standalone: false,
  styleUrl: './socioscomponent.css',
  templateUrl: './socioscomponent.html',
})
export class Socioscomponent implements OnInit {
  socios: SocioModel[] = [];
  termino: string = '';
  terminoBuscado: string = '';
  errorTermino: string = '';
  cargando: boolean = true;
  error: string = '';
  mensaje: string = '';
  puedeInscribir: boolean = false;

  constructor(
    private auth: AuthService,
    private socioService: SocioService,
    private datos: DatosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.mensaje = this.datos.mensajeNavegacion();
    this.puedeInscribir = this.auth.tieneRol(['ADMINISTRADOR', 'BIBLIOTECARIO']);
    this.buscar();
  }

  validarTermino(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La búsqueda debe ser texto.';
    }
    if (valor.trim().length > 80) {
      return 'La búsqueda admite máximo 80 caracteres.';
    }
    return '';
  }

  buscar(): void {
    this.errorTermino = this.validarTermino(this.termino);
    if (this.errorTermino !== '') {
      return;
    }
    const termino = this.termino.trim();
    this.cargando = true;
    this.error = '';
    this.socioService.buscarSocios(termino).subscribe({
      next: (socios) => {
        this.socios = socios;
        this.terminoBuscado = termino;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.error = this.auth.mensajeError(e);
        this.socios = [];
        this.cargando = false;
        this.cdr.markForCheck();
      },
    });
  }
}
