import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EnrollmentRequestService } from '../../../core/services/enrollment-request.service';
import { AuthService } from '../../../core/services/auth.service';
import { SolicitudInscripcion } from '../../../core/models/enrollment-request.model';

@Component({
  selector: 'app-solicitudes-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitudes-admin.component.html',
  styleUrl: './solicitudes-admin.component.scss'
})
export class SolicitudesAdminComponent implements OnInit {
  solicitudes: SolicitudInscripcion[] = [];
  solicitudesFiltradas: SolicitudInscripcion[] = [];
  filtroEstado: 'pendiente' | 'aceptada' | 'rechazada' | '' = 'pendiente';
  loading = true;
  currentUserId = '';

  // Modal de rechazo
  showModalRechazo = false;
  solicitudSeleccionada: SolicitudInscripcion | null = null;
  motivoRechazo = '';

  constructor(
    private enrollmentService: EnrollmentRequestService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    const currentUser = await this.authService.getCurrentUserProfile();

    if (!currentUser || currentUser.rol !== 'admin') {
      alert('Acceso no autorizado');
      this.router.navigate(['/']);
      return;
    }

    this.currentUserId = currentUser.id;

    // Cargar solicitudes
    this.enrollmentService.getSolicitudes().subscribe(
      solicitudes => {
        this.solicitudes = solicitudes;
        this.aplicarFiltro();
        this.loading = false;
      },
      error => {
        console.error('Error cargando solicitudes:', error);
        this.loading = false;
      }
    );
  }

  aplicarFiltro() {
    if (this.filtroEstado) {
      this.solicitudesFiltradas = this.solicitudes.filter(
        s => s.estado === this.filtroEstado
      );
    } else {
      this.solicitudesFiltradas = [...this.solicitudes];
    }
  }

  async aceptarSolicitud(solicitud: SolicitudInscripcion) {
    if (!confirm(`¿Inscribir a ${solicitud.estudianteNombre} en "${solicitud.cursoNombre}"?`)) {
      return;
    }

    try {
      await this.enrollmentService.acceptRequest(solicitud.id, this.currentUserId);
      alert('¡Estudiante inscrito exitosamente!');
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      alert('Error al aceptar la solicitud');
    }
  }

  rechazarSolicitud(solicitud: SolicitudInscripcion) {
    this.solicitudSeleccionada = solicitud;
    this.motivoRechazo = '';
    this.showModalRechazo = true;
  }

  closeModalRechazo() {
    this.showModalRechazo = false;
    this.solicitudSeleccionada = null;
    this.motivoRechazo = '';
  }

  async confirmarRechazo() {
    if (!this.solicitudSeleccionada) return;

    if (!this.motivoRechazo.trim()) {
      alert('Debes ingresar un motivo para el rechazo');
      return;
    }

    try {
      await this.enrollmentService.rejectRequest(
        this.solicitudSeleccionada.id,
        this.currentUserId,
        this.motivoRechazo
      );

      alert('Solicitud rechazada');
      this.closeModalRechazo();
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      alert('Error al rechazar la solicitud');
    }
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
      const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
