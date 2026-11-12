import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Administracioncomponent } from './components/administracioncomponent/administracioncomponent';
import { Auditoriacomponent } from './components/auditoriacomponent/auditoriacomponent';
import { Catalogocomponent } from './components/catalogocomponent/catalogocomponent';
import { Detallelibrocomponent } from './components/detallelibrocomponent/detallelibrocomponent';
import { Detallesociocomponent } from './components/detallesociocomponent/detallesociocomponent';
import { Devolucioncomponent } from './components/devolucioncomponent/devolucioncomponent';
import { Estadisticascomponent } from './components/estadisticascomponent/estadisticascomponent';
import { Logincomponent } from './components/logincomponent/logincomponent';
import { Multascomponent } from './components/multascomponent/multascomponent';
import { Nuevareservacomponent } from './components/nuevareservacomponent/nuevareservacomponent';
import { Nuevolibrocomponent } from './components/nuevolibrocomponent/nuevolibrocomponent';
import { Nuevoprestamocomponent } from './components/nuevoprestamocomponent/nuevoprestamocomponent';
import { Nuevosociocomponent } from './components/nuevosociocomponent/nuevosociocomponent';
import { Nuevotrasladocomponent } from './components/nuevotrasladocomponent/nuevotrasladocomponent';
import { Panelcomponent } from './components/panelcomponent/panelcomponent';
import { Prestamoscomponent } from './components/prestamoscomponent/prestamoscomponent';
import { Reservascomponent } from './components/reservascomponent/reservascomponent';
import { Socioscomponent } from './components/socioscomponent/socioscomponent';
import { Trasladoscomponent } from './components/trasladoscomponent/trasladoscomponent';
import { SesionGuard } from './guards/sesion-guard';

const routes: Routes = [
  { path: '', redirectTo: 'panel', pathMatch: 'full' },
  { path: 'login', component: Logincomponent },
  { path: 'panel', component: Panelcomponent, canActivate: [SesionGuard] },
  { path: 'catalogo', component: Catalogocomponent, canActivate: [SesionGuard] },
  {
    path: 'catalogo/nuevo',
    component: Nuevolibrocomponent,
    canActivate: [SesionGuard],
    data: { roles: ['ADMINISTRADOR', 'BIBLIOTECARIO'] },
  },
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
  {
    path: 'traslados',
    component: Trasladoscomponent,
    canActivate: [SesionGuard],
  },
  {
    path: 'traslados/nuevo',
    component: Nuevotrasladocomponent,
    canActivate: [SesionGuard],
    data: { roles: ['ADMINISTRADOR', 'BIBLIOTECARIO'] },
  },
  { path: 'estadisticas', component: Estadisticascomponent, canActivate: [SesionGuard] },
  {
    path: 'auditoria',
    component: Auditoriacomponent,
    canActivate: [SesionGuard],
    data: { roles: ['ADMINISTRADOR'] },
  },
  {
    path: 'administracion',
    component: Administracioncomponent,
    canActivate: [SesionGuard],
    data: { roles: ['ADMINISTRADOR'] },
  },
  { path: '**', redirectTo: 'panel' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
