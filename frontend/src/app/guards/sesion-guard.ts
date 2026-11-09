import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class SesionGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): MaybeAsync<GuardResult> {
    if (!this.auth.estaAutenticado()) {
      return this.router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
    }
    const roles: unknown = route.data['roles'];
    if (!Array.isArray(roles)) {
      return true;
    }
    const permitidos: string[] = [];
    for (const rol of roles) {
      if (typeof rol === 'string') {
        permitidos.push(rol);
      }
    }
    if (this.auth.tieneRol(permitidos)) {
      return true;
    }
    return this.router.createUrlTree(['/panel']);
  }
}
