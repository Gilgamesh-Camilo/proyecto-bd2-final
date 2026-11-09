import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SocioDetalleModel } from '../../models/socio-detalle.model';
import { AuthService } from '../../services/auth.service';
import { SocioService } from '../../services/socio.service';

@Component({
  selector: 'app-detallesociocomponent',
  standalone: false,
  styleUrl: './detallesociocomponent.css',
  templateUrl: './detallesociocomponent.html',
})
export class Detallesociocomponent implements OnInit {
  detalle: SocioDetalleModel | null = null;
  cargando: boolean = true;
  error: string = '';

  constructor(
    private auth: AuthService,
    private socioService: SocioService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const parametro: unknown = this.route.snapshot.paramMap.get('id');
    const errorId = this.validarId(parametro);
    if (errorId !== '') {
      this.error = errorId;
      this.cargando = false;
      return;
    }
    this.socioService.getSocio(Number(parametro)).subscribe({
      next: (detalle) => {
        this.detalle = detalle;
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

  validarId(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'Falta el código del socio en la dirección.';
    }
    if (!/^[0-9]+$/.test(valor)) {
      return 'El código del socio debe ser un número entero positivo.';
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
      return 'El código del socio debe ser un número entero positivo.';
    }
    return '';
  }

  prestamosAbiertos(): number {
    if (this.detalle === null) {
      return 0;
    }
    return this.detalle.socio.prestamosAbiertos;
  }
}
