import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { EmpleadoModel } from '../../models/empleado.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbarcomponent',
  standalone: false,
  styleUrl: './navbarcomponent.css',
  templateUrl: './navbarcomponent.html',
})
export class Navbarcomponent implements OnInit, OnDestroy {
  empleado: EmpleadoModel | null = null;
  private suscripcion: Subscription | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.empleado = this.auth.getEmpleado();
    this.suscripcion = this.router.events.subscribe({
      next: (evento) => {
        if (evento instanceof NavigationEnd) {
          this.empleado = this.auth.getEmpleado();
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.empleado = this.auth.getEmpleado();
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.suscripcion !== null) {
      this.suscripcion.unsubscribe();
    }
  }

  puede(roles: string[]): boolean {
    return this.auth.tieneRol(roles);
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
