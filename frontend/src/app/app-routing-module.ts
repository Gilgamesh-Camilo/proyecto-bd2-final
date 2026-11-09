import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Catalogocomponent } from './components/catalogocomponent/catalogocomponent';
import { Detallelibrocomponent } from './components/detallelibrocomponent/detallelibrocomponent';
import { Logincomponent } from './components/logincomponent/logincomponent';
import { Panelcomponent } from './components/panelcomponent/panelcomponent';
import { SesionGuard } from './guards/sesion-guard';

const routes: Routes = [
  { path: '', redirectTo: 'panel', pathMatch: 'full' },
  { path: 'login', component: Logincomponent },
  { path: 'panel', component: Panelcomponent, canActivate: [SesionGuard] },
  { path: 'catalogo', component: Catalogocomponent, canActivate: [SesionGuard] },
  { path: 'catalogo/:id', component: Detallelibrocomponent, canActivate: [SesionGuard] },
  { path: '**', redirectTo: 'panel' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
