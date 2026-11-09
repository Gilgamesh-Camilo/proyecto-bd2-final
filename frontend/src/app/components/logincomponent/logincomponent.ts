import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EstadoServidorModel } from '../../models/estado-servidor.model';
import { AuthService } from '../../services/auth.service';
import { CatalogoService } from '../../services/catalogo.service';

@Component({
  selector: 'app-logincomponent',
  standalone: false,
  styleUrl: './logincomponent.css',
  templateUrl: './logincomponent.html',
})
export class Logincomponent implements OnInit {
  usuario: string = '';
  contrasena: string = '';
  verContrasena: boolean = false;
  errorUsuario: string = '';
  errorContrasena: string = '';
  mensaje: string = '';
  enviando: boolean = false;
  estadoServidor: EstadoServidorModel | null = null;
  errorServidor: string = '';

  constructor(
    private auth: AuthService,
    private catalogoService: CatalogoService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.auth.estaAutenticado()) {
      this.router.navigate(['/panel']);
      return;
    }
    this.catalogoService.getEstadoServidor().subscribe({
      next: (estado) => {
        this.estadoServidor = estado;
        this.cdr.markForCheck();
      },
      error: (e: unknown) => {
        this.errorServidor = this.auth.mensajeError(e);
        this.cdr.markForCheck();
      },
    });
  }

  validarUsuario(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'El usuario debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe tu usuario.';
    }
    if (valor.trim().length > 30) {
      return 'El usuario tiene máximo 30 caracteres.';
    }
    return '';
  }

  validarContrasena(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La contraseña debe ser texto.';
    }
    if (valor.trim() === '') {
      return 'Escribe tu contraseña.';
    }
    return '';
  }

  validarVolver(valor: unknown): string {
    if (typeof valor !== 'string') {
      return 'La ruta de regreso no es texto.';
    }
    if (!valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/login')) {
      return 'La ruta de regreso no es válida.';
    }
    return '';
  }

  iniciarSesion(): void {
    this.mensaje = '';
    this.errorUsuario = this.validarUsuario(this.usuario);
    this.errorContrasena = this.validarContrasena(this.contrasena);
    if (this.errorUsuario !== '' || this.errorContrasena !== '') {
      return;
    }
    this.enviando = true;
    this.auth.iniciarSesion(this.usuario.trim(), this.contrasena).subscribe({
      next: () => {
        const volver: unknown = this.route.snapshot.queryParamMap.get('volver');
        if (typeof volver === 'string' && this.validarVolver(volver) === '') {
          this.router.navigateByUrl(volver);
        } else {
          this.router.navigate(['/panel']);
        }
      },
      error: (e: unknown) => {
        this.mensaje = this.auth.mensajeError(e);
        this.enviando = false;
        this.cdr.markForCheck();
      },
    });
  }
}
