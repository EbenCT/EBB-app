import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { EntregaTarea, Tarea } from '../../core/models/task.model';

interface EntregaConEstudiante extends EntregaTarea {
  estudianteNombre?: string;
  estudianteEmail?: string;
}

@Component({
  selector: 'app-lista-entregas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-entregas.component.html',
  styleUrl: './lista-entregas.component.scss'
})
export class ListaEntregasComponent implements OnInit {
  tarea: Tarea | null = null;
  entregas: EntregaConEstudiante[] = [];
  loading: boolean = true;
  currentUser: any = null;

  // Estadísticas
  totalEntregas: number = 0;
  entregasCalificadas: number = 0;
  entregasPendientes: number = 0;
  promedioCalificacion: number = 0;

  constructor(
    private taskService: TaskService,
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    const tareaId = this.route.snapshot.paramMap.get('tareaId');
    if (!tareaId) {
      alert('Tarea no especificada');
      this.goBack();
      return;
    }

    try {
      // Cargar la tarea
      this.tarea = await this.taskService.getTaskById(tareaId);
      if (!this.tarea) {
        alert('Tarea no encontrada');
        this.goBack();
        return;
      }

      // Convertir fechas de Timestamp a Date
      if (this.tarea.fechaInicio) {
        this.tarea.fechaInicio = this.tarea.fechaInicio instanceof Date
          ? this.tarea.fechaInicio
          : (this.tarea.fechaInicio as any).toDate();
      }
      if (this.tarea.fechaFin) {
        this.tarea.fechaFin = this.tarea.fechaFin instanceof Date
          ? this.tarea.fechaFin
          : (this.tarea.fechaFin as any).toDate();
      }

      // Cargar entregas
      const entregas = await this.taskService.getSubmissionsByTask(tareaId);

      // Cargar información de estudiantes
      this.entregas = await Promise.all(
        entregas.map(async (entrega) => {
          // Convertir fecha de entrega
          if (entrega.fechaEntrega) {
            entrega.fechaEntrega = entrega.fechaEntrega instanceof Date
              ? entrega.fechaEntrega
              : (entrega.fechaEntrega as any).toDate();
          }

          try {
            const estudiante = await this.userService.getUserById(entrega.estudianteId);
            return {
              ...entrega,
              estudianteNombre: estudiante?.nombre || 'Desconocido',
              estudianteEmail: estudiante?.email || ''
            };
          } catch (error) {
            console.error('Error cargando estudiante:', error);
            return {
              ...entrega,
              estudianteNombre: 'Desconocido',
              estudianteEmail: ''
            };
          }
        })
      );

      // Calcular estadísticas
      this.calcularEstadisticas();
    } catch (error) {
      console.error('Error cargando entregas:', error);
      alert('Error al cargar las entregas');
      this.goBack();
    } finally {
      this.loading = false;
    }
  }

  calcularEstadisticas() {
    this.totalEntregas = this.entregas.length;
    this.entregasCalificadas = this.entregas.filter(e => e.estado === 'calificada').length;
    this.entregasPendientes = this.entregas.filter(e => e.estado === 'entregada').length;

    const calificadas = this.entregas.filter(e => e.calificacion !== undefined && e.calificacion !== null);
    if (calificadas.length > 0) {
      const suma = calificadas.reduce((acc, e) => acc + (e.calificacion || 0), 0);
      this.promedioCalificacion = suma / calificadas.length;
    }
  }

  calificarEntrega(entregaId: string) {
    if (!this.tarea) return;
    this.router.navigate(['/tareas', this.tarea.id, 'calificar', entregaId]);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'calificada': return 'bg-success';
      case 'entregada': return 'bg-info';
      case 'retrasada': return 'bg-danger';
      case 'pendiente': return 'bg-warning';
      default: return 'bg-secondary';
    }
  }

  getEstadoIcon(estado: string): string {
    switch (estado) {
      case 'calificada': return 'fa-check-circle';
      case 'entregada': return 'fa-clock';
      case 'retrasada': return 'fa-exclamation-triangle';
      case 'pendiente': return 'fa-hourglass-half';
      default: return 'fa-question-circle';
    }
  }

  goBack() {
    this.router.navigate(['/profesor']);
  }

  goToDashboard() {
    this.router.navigate(['/profesor']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
