import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ExamService } from '../../core/services/exam.service';
import { SectionService } from '../../core/services/section.service';
import { AuthService } from '../../core/services/auth.service';
import { Examen } from '../../core/models/exam.model';
import { Seccion } from '../../core/models/section.model';

@Component({
  selector: 'app-examenes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './examenes.component.html',
  styleUrl: './examenes.component.scss'
})
export class ExamenesComponent implements OnInit {
  examenes: Examen[] = [];
  seccion: Seccion | null = null;
  loading: boolean = true;
  currentUser: any = null;

  constructor(
    private examService: ExamService,
    private sectionService: SectionService,
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

    const seccionId = this.route.snapshot.paramMap.get('seccionId');
    if (!seccionId) {
      alert('Sección no especificada');
      this.goBack();
      return;
    }

    try {
      // Cargar la sección
      this.seccion = await this.sectionService.getSectionById(seccionId);
      if (!this.seccion) {
        alert('Sección no encontrada');
        this.goBack();
        return;
      }

      // Cargar los exámenes
      this.examenes = await this.examService.getExamsBySection(seccionId);
    } catch (error) {
      console.error('Error cargando exámenes:', error);
      alert('Error al cargar los exámenes');
    } finally {
      this.loading = false;
    }
  }

  async createExam() {
    if (!this.seccion) return;
    this.router.navigate(['/secciones', this.seccion.id, 'examenes', 'crear']);
  }

  editExam(examenId: string) {
    if (!this.seccion) return;
    this.router.navigate(['/secciones', this.seccion.id, 'examenes', examenId, 'editar']);
  }

  async deleteExam(examen: Examen) {
    if (!confirm(`¿Estás seguro de eliminar el examen "${examen.titulo}"?`)) {
      return;
    }

    try {
      await this.examService.deleteExam(examen.id);
      this.examenes = this.examenes.filter(e => e.id !== examen.id);
      alert('Examen eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando examen:', error);
      alert('Error al eliminar el examen');
    }
  }

  viewAttempts(examenId: string) {
    this.router.navigate(['/secciones', this.seccion?.id, 'examenes', examenId, 'intentos']);
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

  isExamActive(examen: Examen): boolean {
    return this.examService.isExamAvailable(examen);
  }

  async toggleVisibility(examen: Examen) {
    try {
      const newVisibility = examen.visible === false ? true : false;
      await this.examService.updateExam(examen.id, { visible: newVisibility });
      examen.visible = newVisibility;
    } catch (error) {
      console.error('Error actualizando visibilidad:', error);
      alert('Error al cambiar la visibilidad del examen');
    }
  }

  goBack() {
    if (this.seccion) {
      this.router.navigate(['/cursos', this.seccion.cursoId, 'secciones']);
    } else {
      this.router.navigate(['/admin']);
    }
  }

  goToDashboard() {
    this.router.navigate(['/admin']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
