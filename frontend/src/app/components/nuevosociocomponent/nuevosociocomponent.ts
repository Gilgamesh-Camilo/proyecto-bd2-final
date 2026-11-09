import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TipoSocioModel } from '../../models/tipo-socio.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';
import { SocioService } from '../../services/socio.service';

@Component({
  selector: 'app-nuevosociocomponent',
  standalone: false,
  styleUrl: './nuevosociocomponent.css',
  templateUrl: './nuevosociocomponent.html',
})
export class Nuevosociocomponent implements OnInit {
  tiposDocumento: string[] = ['CC', 'TI', 'CE', 'PA'];
  tiposSocio: TipoSocioModel[] = [];
  hoy: string = '';

  tipoDocumento: string = 'CC';
  numeroDocumento: string = '';
  nombres: string = '';
  apellidos: string = '';
  fechaNacimiento: string = '';
  email: string = '';
  telefono: string = '';
  direccion: string = '';
  idTipoSocio: number | null = null;

  errorTipoDocumento: string = '';
  errorNumeroDocumento: string = '';
  errorNombres: string = '';
  errorApellidos: string = '';
  errorFechaNacimiento: string = '';
  errorEmail: string = '';
  errorTelefono: string = '';
  errorDireccion: string = '';
  errorTipoSocio: string = '';
  errorCatalogos: string = '';
  errorGuardar: string = '';
  guardando: boolean = false;

  private letras: RegExp = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private socioService: SocioService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.hoy = this.fechaTexto(new Date());
    this.catalogoService.getCatalogos().subscribe({
      next: (catalogos) => {
        this.tiposSocio = catalogos.tiposSocio;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorCatalogos = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
  }

  nombreDocumento(tipo: string): string {
    if (tipo === 'CC') {
      return 'Cédula de ciudadanía';
    }
    if (tipo === 'TI') {
      return 'Tarjeta de identidad';
    }
    if (tipo === 'CE') {
      return 'Cédula de extranjería';
    }
    return 'Pasaporte';
  }

  tipoSeleccionado(): TipoSocioModel | null {
    for (const tipo of this.tiposSocio) {
      if (tipo.idTipoSocio === this.idTipoSocio) {
        return tipo;
      }
    }
    return null;
  }

  validarTipoDocumento(valor: unknown): string {
    if (typeof valor !== 'string' || this.tiposDocumento.indexOf(valor) === -1) {
      return 'Elige un tipo de documento de la lista.';
    }
    return '';
  }

  validarNumeroDocumento(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El documento debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe el número de documento.';
    }
    if (!/^[A-Za-z0-9]+$/.test(valor.trim())) {
      return 'El documento solo admite letras y números, sin espacios ni puntos.';
    }
    if (valor.trim().length > 20) {
      return 'El documento tiene máximo 20 caracteres.';
    }
    return '';
  }

  validarNombres(valor: unknown): string {
    return this.validarNombre(valor, 'los nombres');
  }

  validarApellidos(valor: unknown): string {
    return this.validarNombre(valor, 'los apellidos');
  }

  validarFechaNacimiento(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La fecha debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe la fecha de nacimiento.';
    }
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(valor)) {
      return 'La fecha debe tener el formato AAAA-MM-DD.';
    }
    const partes = valor.split('-');
    const anio = Number(partes[0]);
    const mes = Number(partes[1]);
    const dia = Number(partes[2]);
    const fecha = new Date(anio, mes - 1, dia);
    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
      return 'La fecha no existe.';
    }
    if (valor >= this.hoy) {
      return 'La fecha de nacimiento debe ser anterior a hoy.';
    }
    return '';
  }

  validarEmail(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El correo debe ser texto.';
    }
    if (valor.trim() === '') {
      return '';
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor.trim())) {
      return 'El correo no tiene un formato válido (ejemplo: nombre@dominio.co).';
    }
    if (valor.trim().length > 120) {
      return 'El correo tiene máximo 120 caracteres.';
    }
    return '';
  }

  validarTelefono(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El teléfono debe ser texto.';
    }
    if (valor.trim() === '') {
      return '';
    }
    if (!/^[0-9]{7,20}$/.test(valor.trim())) {
      return 'El teléfono solo admite números, entre 7 y 20 dígitos.';
    }
    return '';
  }

  validarDireccion(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La dirección debe ser texto.';
    }
    if (valor.trim().length > 150) {
      return 'La dirección tiene máximo 150 caracteres.';
    }
    return '';
  }

  validarTipoSocio(valor: unknown): string {
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
      return 'Elige el tipo de socio.';
    }
    for (const tipo of this.tiposSocio) {
      if (tipo.idTipoSocio === valor) {
        return '';
      }
    }
    return 'Elige el tipo de socio.';
  }

  registrar(): void {
    this.errorGuardar = '';
    this.errorTipoDocumento = this.validarTipoDocumento(this.tipoDocumento);
    this.errorNumeroDocumento = this.validarNumeroDocumento(this.numeroDocumento);
    this.errorNombres = this.validarNombres(this.nombres);
    this.errorApellidos = this.validarApellidos(this.apellidos);
    this.errorFechaNacimiento = this.validarFechaNacimiento(this.fechaNacimiento);
    this.errorEmail = this.validarEmail(this.email);
    this.errorTelefono = this.validarTelefono(this.telefono);
    this.errorDireccion = this.validarDireccion(this.direccion);
    this.errorTipoSocio = this.validarTipoSocio(this.idTipoSocio);
    if (
      this.errorTipoDocumento !== '' ||
      this.errorNumeroDocumento !== '' ||
      this.errorNombres !== '' ||
      this.errorApellidos !== '' ||
      this.errorFechaNacimiento !== '' ||
      this.errorEmail !== '' ||
      this.errorTelefono !== '' ||
      this.errorDireccion !== '' ||
      this.errorTipoSocio !== '' ||
      this.idTipoSocio === null
    ) {
      this.errorGuardar = 'Revisa los campos marcados en rojo.';
      return;
    }
    this.guardando = true;
    this.socioService
      .registrarSocio({
        tipoDocumento: this.tipoDocumento,
        numeroDocumento: this.numeroDocumento.trim(),
        nombres: this.nombres.trim(),
        apellidos: this.apellidos.trim(),
        fechaNacimiento: this.fechaNacimiento,
        email: this.textoOpcional(this.email),
        telefono: this.textoOpcional(this.telefono),
        direccion: this.textoOpcional(this.direccion),
        idTipoSocio: this.idTipoSocio,
      })
      .subscribe({
        next: (resultado) => {
          this.router.navigate(['/socios'], { state: { mensaje: resultado.mensaje } });
        },
        error: (e: unknown) => {
          this.errorGuardar = this.auth.mensajeError(e);
          this.guardando = false;
          this.cdr.markForCheck();
        },
      });
  }

  private validarNombre(valor: unknown, campo: string): string {
    if (typeof valor !== 'string') {
      return 'El campo debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe ' + campo + '.';
    }
    if (!this.letras.test(valor.trim())) {
      return 'Solo se admiten letras y espacios.';
    }
    if (valor.trim().length > 80) {
      return 'Máximo 80 caracteres.';
    }
    return '';
  }

  private textoOpcional(valor: string): string | null {
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }

  private fechaTexto(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return fecha.getFullYear() + '-' + mes + '-' + dia;
  }
}
