import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { EnrollmentRequestService } from '../../../core/services/enrollment-request.service';
import { AuthService } from '../../../core/services/auth.service';
import { SolicitudInscripcion } from '../../../core/models/enrollment-request.model';

@Component({
  selector: 'app-mis-solicitudes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-solicitudes.component.html',
  styleUrl: './mis-solicitudes.component.scss'
})
export class MisSolicitudesComponent implements OnInit {
  solicitudes: SolicitudInscripcion[] = [];
  loading = true;

  constructor(
    private enrollmentService: EnrollmentRequestService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    const currentUser = await this.authService.getCurrentUserProfile();

    if (!currentUser) {
      alert('Debes iniciar sesión');
      this.router.navigate(['/login']);
      return;
    }

    // Cargar solicitudes del estudiante
    this.enrollmentService.getMySolicitudes(currentUser.id).subscribe(
      solicitudes => {
        this.solicitudes = solicitudes;
        this.loading = false;
      },
      error => {
        console.error('Error cargando solicitudes:', error);
        this.loading = false;
      }
    );
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'pendiente':
        return 'bg-warning text-dark';
      case 'aceptada':
        return 'bg-success';
      case 'rechazada':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  formatDate(fecha: any): string {
    if (!fecha) return '-';

    try {
      // Convertir Timestamp de Firestore a Date
      const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '-';
    }
  }

  goBack() {
    this.router.navigate(['/estudiante']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
