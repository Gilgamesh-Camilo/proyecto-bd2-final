import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Logincomponent } from './components/logincomponent/logincomponent';
import { Panelcomponent } from './components/panelcomponent/panelcomponent';
import { SesionGuard } from './guards/sesion-guard';

const routes: Routes = [
  { path: '', redirectTo: 'panel', pathMatch: 'full' },
  { path: 'login', component: Logincomponent },
  { path: 'panel', component: Panelcomponent, canActivate: [SesionGuard] },
  { path: '**', redirectTo: 'panel' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
