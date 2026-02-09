import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { LessonService } from '../../core/services/lesson.service';
import { AuthService } from '../../core/services/auth.service';
import { Tarea, EntregaTarea } from '../../core/models/task.model';
import { Leccion } from '../../core/models/lesson.model';

@Component({
  selector: 'app-tareas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './tareas.component.html',
  styleUrl: './tareas.component.scss'
})
export class TareasComponent implements OnInit {
  leccion: Leccion | null = null;
  tareas: Tarea[] = [];
  loading = true;

  // Modales
  showCreateModal = false;
  showEditModal = false;
  showSubmissionsModal = false;
  selectedTarea: Tarea | null = null;
  entregas: EntregaTarea[] = [];

  // Nueva tarea
  newTarea = {
    titulo: '',
    descripcion: '',
    instrucciones: '',
    tipoEntrega: 'ambos' as 'texto' | 'archivo' | 'ambos',
    fechaInicio: '',
    fechaFin: '',
    ponderacion: 10,
    archivosPermitidos: '.pdf,.docx,.jpg,.png',
    tamanoMaximo: 5
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private taskService: TaskService,
    private lessonService: LessonService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const leccionId = this.route.snapshot.paramMap.get('leccionId');
    if (leccionId) {
      this.loadLesson(leccionId);
      this.loadTareas(leccionId);
    }
  }

  async loadLesson(leccionId: string) {
    try {
      this.leccion = await this.lessonService.getLessonById(leccionId);
    } catch (error) {
      console.error('Error cargando lección:', error);
    }
  }

  async loadTareas(leccionId: string) {
    this.loading = true;
    try {
      this.taskService.getTasksByLesson(leccionId).subscribe({
        next: (tareas) => {
          this.tareas = tareas;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando tareas:', error);
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('Error cargando tareas:', error);
      this.loading = false;
    }
  }

  openCreateModal() {
    // Configurar fechas por defecto
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    this.newTarea = {
      titulo: '',
      descripcion: '',
      instrucciones: '',
      tipoEntrega: 'ambos',
      fechaInicio: this.formatDateForInput(now),
      fechaFin: this.formatDateForInput(nextWeek),
      ponderacion: 10,
      archivosPermitidos: '.pdf,.docx,.jpg,.png',
      tamanoMaximo: 5
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  async createTarea() {
    if (!this.leccion || !this.newTarea.titulo) {
      alert('Por favor completa el título de la tarea');
      return;
    }

    if (!this.newTarea.fechaInicio || !this.newTarea.fechaFin) {
      alert('Por favor configura las fechas de la tarea');
      return;
    }

    try {
      const archivosArray = this.newTarea.archivosPermitidos
        ? this.newTarea.archivosPermitidos.split(',').map(ext => ext.trim())
        : [];

      await this.taskService.createTask({
        leccionId: this.leccion.id,
        titulo: this.newTarea.titulo,
        descripcion: this.newTarea.descripcion,
        instrucciones: this.newTarea.instrucciones,
        tipoEntrega: this.newTarea.tipoEntrega,
        fechaInicio: new Date(this.newTarea.fechaInicio),
        fechaFin: new Date(this.newTarea.fechaFin),
        ponderacion: this.newTarea.ponderacion,
        archivosPermitidos: archivosArray,
        tamanoMaximo: this.newTarea.tamanoMaximo
      });

      alert('Tarea creada exitosamente');
      this.closeCreateModal();
      // Recargar tareas
      if (this.leccion) {
        this.loadTareas(this.leccion.id);
      }
    } catch (error) {
      console.error('Error creando tarea:', error);
      alert('Error al crear tarea');
    }
  }

  editTarea(tarea: Tarea) {
    this.selectedTarea = { ...tarea };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedTarea = null;
  }

  async saveTarea() {
    if (!this.selectedTarea) return;

    try {
      await this.taskService.updateTask(this.selectedTarea.id, {
        titulo: this.selectedTarea.titulo,
        descripcion: this.selectedTarea.descripcion,
        instrucciones: this.selectedTarea.instrucciones,
        tipoEntrega: this.selectedTarea.tipoEntrega,
        fechaInicio: this.selectedTarea.fechaInicio,
        fechaFin: this.selectedTarea.fechaFin,
        ponderacion: this.selectedTarea.ponderacion,
        archivosPermitidos: this.selectedTarea.archivosPermitidos,
        tamanoMaximo: this.selectedTarea.tamanoMaximo
      });

      alert('Tarea actualizada correctamente');
      this.closeEditModal();
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      alert('Error al actualizar tarea');
    }
  }

  async deleteTarea(tarea: Tarea) {
    if (confirm(`¿Está seguro de eliminar la tarea "${tarea.titulo}"? Esto eliminará también todas las entregas.`)) {
      try {
        await this.taskService.deleteTask(tarea.id);
        alert('Tarea eliminada correctamente');
      } catch (error) {
        console.error('Error eliminando tarea:', error);
        alert('Error al eliminar tarea');
      }
    }
  }

  async viewSubmissions(tarea: Tarea) {
    this.selectedTarea = tarea;
    try {
      this.entregas = await this.taskService.getSubmissionsByTask(tarea.id);
      this.showSubmissionsModal = true;
    } catch (error) {
      console.error('Error cargando entregas:', error);
      alert('Error al cargar entregas');
    }
  }

  closeSubmissionsModal() {
    this.showSubmissionsModal = false;
    this.selectedTarea = null;
    this.entregas = [];
  }

  formatDate(date: Date | any): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'entregada':
        return 'bg-success';
      case 'calificada':
        return 'bg-primary';
      case 'retrasada':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  getTipoEntregaText(tipo: string): string {
    switch (tipo) {
      case 'texto':
        return 'Solo texto';
      case 'archivo':
        return 'Solo archivo';
      case 'ambos':
        return 'Texto y archivo';
      default:
        return tipo;
    }
  }

  async toggleVisibility(tarea: Tarea) {
    try {
      const newVisibility = tarea.visible === false ? true : false;
      await this.taskService.updateTask(tarea.id, { visible: newVisibility });
      tarea.visible = newVisibility;
    } catch (error) {
      console.error('Error actualizando visibilidad:', error);
      alert('Error al cambiar la visibilidad de la tarea');
    }
  }

  goToGrade(entrega: EntregaTarea) {
    if (this.selectedTarea) {
      this.router.navigate(['/tareas', this.selectedTarea.id, 'calificar', entrega.id]);
    }
  }

  goToDashboard() {
    this.authService.getCurrentUserProfile().then(currentUser => {
      if (currentUser) {
        const userRole = currentUser.rol;
        if (userRole === 'admin') {
          this.router.navigate(['/admin']);
        } else if (userRole === 'profesor') {
          this.router.navigate(['/profesor']);
        } else if (userRole === 'estudiante') {
          this.router.navigate(['/estudiante']);
        }
      }
    });
  }

  goBack() {
    // Volver a gestión de lecciones o dashboard
    this.router.navigate(['/profesor']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
