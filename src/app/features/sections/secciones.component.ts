import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SectionService } from '../../core/services/section.service';
import { CourseService } from '../../core/services/course.service';
import { AuthService } from '../../core/services/auth.service';
import { Seccion } from '../../core/models/section.model';
import { Curso } from '../../core/models/course.model';

@Component({
  selector: 'app-secciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './secciones.component.html',
  styleUrl: './secciones.component.scss'
})
export class SeccionesComponent implements OnInit {
  curso: Curso | null = null;
  secciones: Seccion[] = [];
  loading = true;

  // Modales
  showCreateModal = false;
  showEditModal = false;
  selectedSection: Seccion | null = null;

  // Nueva sección
  newSection = {
    titulo: '',
    descripcion: '',
    desbloqueoProgresivo: false,
    prerequisitos: [] as string[],
    requiereCompletarTodo: false,
    porcentajeMinimo: 70
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sectionService: SectionService,
    private courseService: CourseService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const cursoId = this.route.snapshot.paramMap.get('cursoId');
    if (cursoId) {
      this.loadCurso(cursoId);
      this.loadSecciones(cursoId);
    }
  }

  async loadCurso(cursoId: string) {
    try {
      this.curso = await this.courseService.getCourseById(cursoId);
    } catch (error) {
      console.error('Error cargando curso:', error);
    }
  }

  loadSecciones(cursoId: string) {
    this.loading = true;
    this.sectionService.getSectionsByCourse(cursoId).subscribe({
      next: (secciones) => {
        this.secciones = secciones;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando secciones:', error);
        this.loading = false;
      }
    });
  }

  openCreateModal() {
    this.newSection = {
      titulo: '',
      descripcion: '',
      desbloqueoProgresivo: false,
      prerequisitos: [],
      requiereCompletarTodo: false,
      porcentajeMinimo: 70
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  async createSection() {
    if (!this.curso || !this.newSection.titulo) {
      alert('Por favor completa el título de la sección');
      return;
    }

    try {
      await this.sectionService.createSection({
        cursoId: this.curso.id,
        titulo: this.newSection.titulo,
        descripcion: this.newSection.descripcion,
        desbloqueoProgresivo: this.newSection.desbloqueoProgresivo,
        prerequisitos: this.newSection.prerequisitos,
        requiereCompletarTodo: this.newSection.requiereCompletarTodo,
        porcentajeMinimo: this.newSection.porcentajeMinimo,
        orden: this.secciones.length
      });

      alert('Sección creada exitosamente');
      this.closeCreateModal();
    } catch (error) {
      console.error('Error creando sección:', error);
      alert('Error al crear sección');
    }
  }

  editSection(section: Seccion) {
    this.selectedSection = {
      ...section,
      prerequisitos: section.prerequisitos || [],
      requiereCompletarTodo: section.requiereCompletarTodo || false,
      porcentajeMinimo: section.porcentajeMinimo || 70
    };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedSection = null;
  }

  async saveSection() {
    if (!this.selectedSection) return;

    try {
      await this.sectionService.updateSection(this.selectedSection.id, {
        titulo: this.selectedSection.titulo,
        descripcion: this.selectedSection.descripcion,
        desbloqueoProgresivo: this.selectedSection.desbloqueoProgresivo,
        prerequisitos: this.selectedSection.prerequisitos,
        requiereCompletarTodo: this.selectedSection.requiereCompletarTodo,
        porcentajeMinimo: this.selectedSection.porcentajeMinimo
      });

      alert('Sección actualizada correctamente');
      this.closeEditModal();
    } catch (error) {
      console.error('Error actualizando sección:', error);
      alert('Error al actualizar sección');
    }
  }

  async deleteSection(section: Seccion) {
    if (confirm(`¿Está seguro de eliminar la sección "${section.titulo}"? Esto eliminará también todas sus lecciones.`)) {
      try {
        await this.sectionService.deleteSection(section.id);
        alert('Sección eliminada correctamente');
      } catch (error) {
        console.error('Error eliminando sección:', error);
        alert('Error al eliminar sección');
      }
    }
  }

  goToLessons(seccionId: string) {
    this.router.navigate(['/secciones', seccionId, 'lecciones']);
  }

  goToExams(seccionId: string) {
    this.router.navigate(['/secciones', seccionId, 'examenes']);
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
    this.router.navigate(['/cursos']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  // Helpers para prerrequisitos
  togglePrerequisitoCreate(seccionId: string) {
    const index = this.newSection.prerequisitos.indexOf(seccionId);
    if (index > -1) {
      this.newSection.prerequisitos.splice(index, 1);
    } else {
      this.newSection.prerequisitos.push(seccionId);
    }
  }

  isPrerequisitoSelectedCreate(seccionId: string): boolean {
    return this.newSection.prerequisitos.includes(seccionId);
  }

  togglePrerequisitoEdit(seccionId: string) {
    if (!this.selectedSection) return;
    if (!this.selectedSection.prerequisitos) {
      this.selectedSection.prerequisitos = [];
    }
    const index = this.selectedSection.prerequisitos.indexOf(seccionId);
    if (index > -1) {
      this.selectedSection.prerequisitos.splice(index, 1);
    } else {
      this.selectedSection.prerequisitos.push(seccionId);
    }
  }

  isPrerequisitoSelectedEdit(seccionId: string): boolean {
    return this.selectedSection?.prerequisitos?.includes(seccionId) || false;
  }

  get seccionesDisponiblesParaPrerequisitos(): Seccion[] {
    // Para crear: todas las secciones existentes
    // Para editar: todas excepto la actual y sus dependientes
    if (this.showEditModal && this.selectedSection) {
      return this.secciones.filter(s => s.id !== this.selectedSection!.id);
    }
    return this.secciones;
  }

  getSeccionTitulo(seccionId: string): string {
    const seccion = this.secciones.find(s => s.id === seccionId);
    return seccion ? `${seccion.orden + 1}. ${seccion.titulo}` : 'Desconocida';
  }
}
