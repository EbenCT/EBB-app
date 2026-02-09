import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CourseService } from '../../../core/services/course.service';
import { SectionService } from '../../../core/services/section.service';
import { LessonService } from '../../../core/services/lesson.service';
import { TaskService } from '../../../core/services/task.service';
import { Router } from '@angular/router';
import { Curso } from '../../../core/models/course.model';
import { Seccion } from '../../../core/models/section.model';
import { EntregaTarea } from '../../../core/models/task.model';

interface CursoConEstadisticas extends Curso {
  totalSecciones: number;
  tareasRevisar: number;
}

@Component({
  selector: 'app-profesor-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profesor-dashboard.component.html',
  styleUrl: './profesor-dashboard.component.scss'
})
export class ProfesorDashboardComponent implements OnInit {
  userName: string = '';
  cursos: CursoConEstadisticas[] = [];
  loading: boolean = true;
  currentUserId: string = '';
  cursosExpandidos: Set<string> = new Set();

  constructor(
    private authService: AuthService,
    private courseService: CourseService,
    private sectionService: SectionService,
    private lessonService: LessonService,
    private taskService: TaskService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.authService.userProfile$.subscribe(async profile => {
      if (profile) {
        this.userName = profile.nombre + ' ' + profile.apellido;
        this.currentUserId = profile.id || '';
        await this.cargarCursosAsignados();
      }
    });
  }

  async cargarCursosAsignados() {
    this.loading = true;
    try {
      // Obtener cursos del profesor
      const cursosProfesor = await this.courseService.getCoursesByProfesor(this.currentUserId);

      // Cargar estadísticas para cada curso
      this.cursos = await Promise.all(
        cursosProfesor.map(async curso => {
          // Contar secciones
          const secciones = await firstValueFrom(this.sectionService.getSectionsByCourse(curso.id));
          const totalSecciones = secciones.length;

          // Contar tareas pendientes de revisar
          let tareasRevisar = 0;
          for (const seccion of secciones) {
            // Obtener lecciones de la sección
            const lecciones = await firstValueFrom(this.lessonService.getLessonsBySection(seccion.id));

            for (const leccion of lecciones) {
              // Obtener tareas de la lección
              if (leccion.tareas && leccion.tareas.length > 0) {
                for (const tareaId of leccion.tareas) {
                  const entregas = await this.taskService.getSubmissionsByTask(tareaId);
                  // Contar entregas no calificadas
                  tareasRevisar += entregas.filter(e => e.estado === 'entregada').length;
                }
              }
            }
          }

          return {
            ...curso,
            totalSecciones,
            tareasRevisar
          };
        })
      );
    } catch (error) {
      console.error('Error cargando cursos:', error);
      alert('Error al cargar los cursos');
    } finally {
      this.loading = false;
    }
  }

  verCurso(cursoId: string) {
    this.router.navigate(['/curso', cursoId]);
  }

  goToDashboard() {
    // Ya estamos en el dashboard
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  truncateText(text: string, maxLength: number = 120): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  toggleDescripcion(cursoId: string): void {
    if (this.cursosExpandidos.has(cursoId)) {
      this.cursosExpandidos.delete(cursoId);
    } else {
      this.cursosExpandidos.add(cursoId);
    }
  }

  isExpanded(cursoId: string): boolean {
    return this.cursosExpandidos.has(cursoId);
  }

  getDescripcion(curso: CursoConEstadisticas): string {
    if (this.isExpanded(curso.id)) {
      return curso.descripcion;
    }
    return this.truncateText(curso.descripcion);
  }

  shouldShowToggle(descripcion: string): boolean {
    return !!(descripcion && descripcion.length > 120);
  }
}
