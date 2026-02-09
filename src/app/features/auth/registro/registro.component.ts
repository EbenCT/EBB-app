import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.scss'
})
export class RegistroComponent {
  nombre = '';
  apellido = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async register() {
    // Validaciones
    if (!this.nombre || !this.apellido || !this.email || !this.password) {
      alert('Por favor completa todos los campos');
      return;
    }

    if (this.password !== this.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (this.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    this.loading = true;
    try {
      // Llamar al nuevo método registerPublic
      await this.authService.registerPublic(
        this.email,
        this.password,
        this.nombre,
        this.apellido
      );

      alert('¡Cuenta creada exitosamente!');
      // Redirigir al dashboard del estudiante
      this.router.navigate(['/estudiante']);
    } catch (error: any) {
      console.error('Error en registro:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('Este correo ya está registrado');
      } else if (error.code === 'auth/invalid-email') {
        alert('Correo electrónico inválido');
      } else if (error.code === 'auth/weak-password') {
        alert('La contraseña es demasiado débil');
      } else {
        alert('Error al crear la cuenta');
      }
    } finally {
      this.loading = false;
    }
  }

  async registerWithGoogle() {
    this.loading = true;
    try {
      await this.authService.loginWithGoogle();
      alert('¡Bienvenido!');
      this.router.navigate(['/estudiante']);
    } catch (error: any) {
      console.error('Error con Google:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        // Usuario cerró el popup, no mostrar error
      } else {
        alert('Error al iniciar sesión con Google');
      }
    } finally {
      this.loading = false;
    }
  }
}
