import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Catalogocomponent } from './components/catalogocomponent/catalogocomponent';
import { Detallelibrocomponent } from './components/detallelibrocomponent/detallelibrocomponent';
import { Detallesociocomponent } from './components/detallesociocomponent/detallesociocomponent';
import { Devolucioncomponent } from './components/devolucioncomponent/devolucioncomponent';
import { Logincomponent } from './components/logincomponent/logincomponent';
import { Multascomponent } from './components/multascomponent/multascomponent';
import { Nuevareservacomponent } from './components/nuevareservacomponent/nuevareservacomponent';
import { Nuevoprestamocomponent } from './components/nuevoprestamocomponent/nuevoprestamocomponent';
import { Nuevosociocomponent } from './components/nuevosociocomponent/nuevosociocomponent';
import { Panelcomponent } from './components/panelcomponent/panelcomponent';
import { Prestamoscomponent } from './components/prestamoscomponent/prestamoscomponent';
import { Reservascomponent } from './components/reservascomponent/reservascomponent';
import { Socioscomponent } from './components/socioscomponent/socioscomponent';
import { SesionGuard } from './guards/sesion-guard';

const routes: Routes = [
  { path: '', redirectTo: 'panel', pathMatch: 'full' },
  { path: 'login', component: Logincomponent },
  { path: 'panel', component: Panelcomponent, canActivate: [SesionGuard] },
  { path: 'catalogo', component: Catalogocomponent, canActivate: [SesionGuard] },
  { path: 'catalogo/:id', component: Detallelibrocomponent, canActivate: [SesionGuard] },
  { path: 'prestamos', component: Prestamoscomponent, canActivate: [SesionGuard] },
  { path: 'prestamos/nuevo', component: Nuevoprestamocomponent, canActivate: [SesionGuard] },
  {
    path: 'prestamos/:id/devolucion',
    component: Devolucioncomponent,
    canActivate: [SesionGuard],
  },
  { path: 'socios', component: Socioscomponent, canActivate: [SesionGuard] },
  {
    path: 'socios/nuevo',
    component: Nuevosociocomponent,
    canActivate: [SesionGuard],
    data: { roles: ['ADMINISTRADOR', 'BIBLIOTECARIO'] },
  },
  { path: 'socios/:id', component: Detallesociocomponent, canActivate: [SesionGuard] },
  { path: 'reservas', component: Reservascomponent, canActivate: [SesionGuard] },
  { path: 'reservas/nueva', component: Nuevareservacomponent, canActivate: [SesionGuard] },
  { path: 'multas', component: Multascomponent, canActivate: [SesionGuard] },
  { path: '**', redirectTo: 'panel' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
