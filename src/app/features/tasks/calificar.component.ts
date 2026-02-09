import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { EntregaTarea } from '../../core/models/task.model';
import { Tarea } from '../../core/models/task.model';

@Component({
  selector: 'app-calificar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calificar.component.html',
  styleUrl: './calificar.component.scss'
})
export class CalificarComponent implements OnInit {
  entrega: EntregaTarea | null = null;
  tarea: Tarea | null = null;
  calificacion: number = 0;
  retroalimentacion: string = '';
  loading: boolean = false;
  tareaId: string = '';
  estudianteNombre: string = '';
  estudianteEmail: string = '';

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    const tareaId = this.route.snapshot.paramMap.get('tareaId');
    const entregaId = this.route.snapshot.paramMap.get('entregaId');

    if (!tareaId || !entregaId) {
      alert('Parámetros inválidos');
      this.goBack();
      return;
    }

    this.tareaId = tareaId;

    try {
      // Cargar la tarea
      this.tarea = await this.taskService.getTaskById(tareaId);

      // Convertir fechas de la tarea
      if (this.tarea) {
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
      }

      // Cargar la entrega
      const entregas = await this.taskService.getSubmissionsByTask(tareaId);
      this.entrega = entregas.find(e => e.id === entregaId) || null;

      if (!this.entrega) {
        alert('Entrega no encontrada');
        this.goBack();
        return;
      }

      // Convertir fecha de entrega
      if (this.entrega.fechaEntrega) {
        this.entrega.fechaEntrega = this.entrega.fechaEntrega instanceof Date
          ? this.entrega.fechaEntrega
          : (this.entrega.fechaEntrega as any).toDate();
      }

      // Cargar información del estudiante
      const estudiante = await this.userService.getUserById(this.entrega.estudianteId);
      if (estudiante) {
        this.estudianteNombre = estudiante.nombre;
        this.estudianteEmail = estudiante.email;
      }

      // Si ya está calificada, pre-llenar los campos
      if (this.entrega.calificacion !== undefined) {
        this.calificacion = this.entrega.calificacion;
      }
      if (this.entrega.retroalimentacion) {
        this.retroalimentacion = this.entrega.retroalimentacion;
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar la entrega');
      this.goBack();
    }
  }

  async saveGrade() {
    if (!this.entrega) return;

    // Validar calificación
    if (this.calificacion < 0 || this.calificacion > 100) {
      alert('La calificación debe estar entre 0 y 100');
      return;
    }

    if (!confirm('¿Está seguro de guardar esta calificación?')) {
      return;
    }

    this.loading = true;
    try {
      await this.taskService.gradeSubmission(
        this.entrega.id,
        this.calificacion,
        this.retroalimentacion
      );
      alert('Calificación guardada exitosamente');
      this.goBack();
    } catch (error) {
      console.error('Error guardando calificación:', error);
      alert('Error al guardar la calificación');
    } finally {
      this.loading = false;
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
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

  getTipoEntregaText(tipo: string): string {
    switch (tipo) {
      case 'texto': return 'Solo Texto';
      case 'archivo': return 'Solo Archivo';
      case 'ambos': return 'Texto y Archivo';
      default: return tipo;
    }
  }

  goToDashboard() {
    this.router.navigate(['/profesor']);
  }

  goBack() {
    // Volver a la lista de entregas si tenemos tareaId
    if (this.tareaId) {
      this.router.navigate(['/tareas', this.tareaId, 'entregas']);
    } else {
      this.router.navigate(['/profesor']);
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
