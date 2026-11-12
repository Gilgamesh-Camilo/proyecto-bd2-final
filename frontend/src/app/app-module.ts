import { LOCALE_ID, NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { Navbarcomponent } from './components/navbarcomponent/navbarcomponent';
import { Footercomponent } from './components/footercomponent/footercomponent';
import { Logincomponent } from './components/logincomponent/logincomponent';
import { Panelcomponent } from './components/panelcomponent/panelcomponent';
import { Catalogocomponent } from './components/catalogocomponent/catalogocomponent';
import { Tarjetalibrocomponent } from './components/tarjetalibrocomponent/tarjetalibrocomponent';
import { Detallelibrocomponent } from './components/detallelibrocomponent/detallelibrocomponent';
import { Nuevolibrocomponent } from './components/nuevolibrocomponent/nuevolibrocomponent';
import { Prestamoscomponent } from './components/prestamoscomponent/prestamoscomponent';
import { Nuevoprestamocomponent } from './components/nuevoprestamocomponent/nuevoprestamocomponent';
import { Devolucioncomponent } from './components/devolucioncomponent/devolucioncomponent';
import { Socioscomponent } from './components/socioscomponent/socioscomponent';
import { Nuevosociocomponent } from './components/nuevosociocomponent/nuevosociocomponent';
import { Detallesociocomponent } from './components/detallesociocomponent/detallesociocomponent';
import { Reservascomponent } from './components/reservascomponent/reservascomponent';
import { Nuevareservacomponent } from './components/nuevareservacomponent/nuevareservacomponent';
import { Multascomponent } from './components/multascomponent/multascomponent';
import { Trasladoscomponent } from './components/trasladoscomponent/trasladoscomponent';
import { Nuevotrasladocomponent } from './components/nuevotrasladocomponent/nuevotrasladocomponent';
import { Estadisticascomponent } from './components/estadisticascomponent/estadisticascomponent';
import { Auditoriacomponent } from './components/auditoriacomponent/auditoriacomponent';
import { Administracioncomponent } from './components/administracioncomponent/administracioncomponent';
import { EstadoPipe } from './pipes/estado-pipe';

registerLocaleData(localeEsCo);

@NgModule({
  declarations: [
    App,
    Navbarcomponent,
    Footercomponent,
    Logincomponent,
    Panelcomponent,
    Catalogocomponent,
    Tarjetalibrocomponent,
    Detallelibrocomponent,
    Nuevolibrocomponent,
    Prestamoscomponent,
    Nuevoprestamocomponent,
    Devolucioncomponent,
    Socioscomponent,
    Nuevosociocomponent,
    Detallesociocomponent,
    Reservascomponent,
    Nuevareservacomponent,
    Multascomponent,
    Trasladoscomponent,
    Nuevotrasladocomponent,
    Estadisticascomponent,
    Auditoriacomponent,
    Administracioncomponent,
    EstadoPipe,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'es-CO' },
  ],
  bootstrap: [App],
})
export class AppModule {}
