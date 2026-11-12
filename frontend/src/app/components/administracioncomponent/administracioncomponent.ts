import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CuentaEmpleadoModel } from '../../models/cuenta-empleado.model';
import { SedeDetalleModel } from '../../models/sede-detalle.model';
import { AuthService } from '../../services/auth.service';
import { EmpleadoService } from '../../services/empleado.service';
import { SedeService } from '../../services/sede.service';

@Component({
  selector: 'app-administracioncomponent',
  standalone: false,
  styleUrl: './administracioncomponent.css',
  templateUrl: './administracioncomponent.html',
})
export class Administracioncomponent implements OnInit {
  sedes: SedeDetalleModel[] = [];
  empleados: CuentaEmpleadoModel[] = [];
  cargandoSedes: boolean = true;
  cargandoEmpleados: boolean = true;
  errorSedes: string = '';
  errorEmpleados: string = '';

  mostrandoFormulario: boolean = false;
  nombre: string = '';
  direccion: string = '';
  ciudad: string = '';
  telefono: string = '';
  fechaApertura: string = '';
  errorNombre: string = '';
  errorDireccion: string = '';
  errorCiudad: string = '';
  errorTelefono: string = '';
  errorFechaApertura: string = '';
  errorGuardar: string = '';
  guardando: boolean = false;

  mensajeSedes: string = '';
  errorAccionSedes: string = '';
  confirmandoSede: number | null = null;
  cambiandoSede: number | null = null;

  mensajeEmpleados: string = '';
  errorAccionEmpleados: string = '';
  desbloqueando: number | null = null;

  constructor(
    private auth: AuthService,
    private sedeService: SedeService,
    private empleadoService: EmpleadoService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarSedes();
    this.cargarEmpleados();
  }

  cargarSedes(): void {
    this.cargandoSedes = true;
    this.errorSedes = '';
    this.sedeService.getSedes().subscribe({
      next: (sedes) => {
        this.sedes = sedes;
        this.cargandoSedes = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorSedes = this.auth.mensajeError(e);
        this.sedes = [];
        this.cargandoSedes = false;
        this.cdr.markForCheck();
      },
    });
  }

  cargarEmpleados(): void {
    this.cargandoEmpleados = true;
    this.errorEmpleados = '';
    this.empleadoService.getEmpleados().subscribe({
      next: (empleados) => {
        this.empleados = empleados;
        this.cargandoEmpleados = false;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorEmpleados = this.auth.mensajeError(e);
        this.empleados = [];
        this.cargandoEmpleados = false;
        this.cdr.markForCheck();
      },
    });
  }

  bloqueados(): number {
    let total: number = 0;
    for (const empleado of this.empleados) {
      if (empleado.estado === 'BLOQUEADO') {
        total = total + 1;
      }
    }
    return total;
  }

  abrirFormulario(): void {
    this.mostrandoFormulario = true;
    this.mensajeSedes = '';
    this.errorAccionSedes = '';
  }

  cerrarFormulario(): void {
    this.mostrandoFormulario = false;
    this.nombre = '';
    this.direccion = '';
    this.ciudad = '';
    this.telefono = '';
    this.fechaApertura = '';
    this.errorNombre = '';
    this.errorDireccion = '';
    this.errorCiudad = '';
    this.errorTelefono = '';
    this.errorFechaApertura = '';
    this.errorGuardar = '';
  }

  validarNombre(valor: unknown): string {
    return this.validarTexto(valor, 'el nombre de la sede', 80);
  }

  validarDireccion(valor: unknown): string {
    return this.validarTexto(valor, 'la dirección', 150);
  }

  validarCiudad(valor: unknown): string {
    return this.validarTexto(valor, 'la ciudad', 60);
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

  validarFechaApertura(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La fecha debe ser texto.';
    }
    if (valor.trim() === '') {
      return '';
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
    return '';
  }

  validarEstadoSede(valor: unknown): string {
    if (valor !== 'ACTIVA' && valor !== 'CERRADA') {
      return 'Ese estado no existe.';
    }
    return '';
  }

  registrarSede(): void {
    this.errorGuardar = '';
    this.errorNombre = this.validarNombre(this.nombre);
    this.errorDireccion = this.validarDireccion(this.direccion);
    this.errorCiudad = this.validarCiudad(this.ciudad);
    this.errorTelefono = this.validarTelefono(this.telefono);
    this.errorFechaApertura = this.validarFechaApertura(this.fechaApertura);
    if (
      this.errorNombre !== '' ||
      this.errorDireccion !== '' ||
      this.errorCiudad !== '' ||
      this.errorTelefono !== '' ||
      this.errorFechaApertura !== ''
    ) {
      this.errorGuardar = 'Revisa los campos marcados en rojo.';
      return;
    }
    this.guardando = true;
    this.sedeService
      .registrarSede({
        nombre: this.nombre.trim(),
        direccion: this.direccion.trim(),
        ciudad: this.ciudad.trim(),
        telefono: this.textoOpcional(this.telefono),
        fechaApertura: this.textoOpcional(this.fechaApertura),
      })
      .subscribe({
        next: (resultado) => {
          this.guardando = false;
          this.cerrarFormulario();
          this.mensajeSedes = resultado.mensaje;
          this.cargarSedes();
        },
        error: (e: unknown) => {
          this.guardando = false;
          this.errorGuardar = this.auth.mensajeError(e);
          this.cdr.markForCheck();
        },
      });
  }

  cambiarEstadoSede(sede: SedeDetalleModel): void {
    this.mensajeSedes = '';
    this.errorAccionSedes = '';
    this.confirmandoSede = null;
    let estado: string = 'CERRADA';
    if (sede.estado === 'CERRADA') {
      estado = 'ACTIVA';
    }
    const errorEstado = this.validarEstadoSede(estado);
    if (errorEstado !== '') {
      this.errorAccionSedes = errorEstado;
      return;
    }
    this.cambiandoSede = sede.idSede;
    this.sedeService.cambiarEstado(sede.idSede, estado).subscribe({
      next: (resultado) => {
        this.cambiandoSede = null;
        this.mensajeSedes = sede.nombre + ': ' + resultado.mensaje;
        this.cargarSedes();
      },
      error: (e: unknown) => {
        this.cambiandoSede = null;
        this.errorAccionSedes = sede.nombre + ': ' + this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
  }

  desbloquear(empleado: CuentaEmpleadoModel): void {
    this.mensajeEmpleados = '';
    this.errorAccionEmpleados = '';
    if (empleado.estado !== 'BLOQUEADO') {
      this.errorAccionEmpleados = 'Esa cuenta no está bloqueada.';
      return;
    }
    this.desbloqueando = empleado.idEmpleado;
    this.empleadoService.desbloquear(empleado.idEmpleado).subscribe({
      next: (resultado) => {
        this.desbloqueando = null;
        this.mensajeEmpleados = empleado.usuario + ': ' + resultado.mensaje;
        this.cargarEmpleados();
      },
      error: (e: unknown) => {
        this.desbloqueando = null;
        this.errorAccionEmpleados = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
  }

  private validarTexto(valor: unknown, campo: string, maximo: number): string {
    if (typeof valor !== 'string') {
      return 'El campo debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe ' + campo + '.';
    }
    if (valor.trim().length > maximo) {
      return 'Máximo ' + maximo + ' caracteres.';
    }
    return '';
  }

  private textoOpcional(valor: string): string | null {
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }
}
