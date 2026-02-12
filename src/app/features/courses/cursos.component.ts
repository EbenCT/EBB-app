import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CourseService } from '../../core/services/course.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { Curso } from '../../core/models/course.model';
import { UserModel } from '../../core/models/user.model';

// Interfaz extendida para incluir el nombre del profesor (no está en el modelo)
interface CursoConProfesor extends Curso {
  profesorNombre?: string;
}

@Component({
  selector: 'app-cursos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cursos.component.html',
  styleUrl: './cursos.component.scss'
})
export class CursosComponent implements OnInit {
  cursos: CursoConProfesor[] = [];
  cursosFiltrados: CursoConProfesor[] = [];
  profesores: UserModel[] = [];
  estudiantes: UserModel[] = [];
  loading = true;

  // Filtros
  searchTerm = '';
  filterStatus: 'todos' | 'activos' | 'inactivos' = 'todos';

  // Modales
  showCreateModal = false;
  showEditModal = false;
  showEnrollModal = false;
  selectedCourse: Curso | null = null;

  // Nuevo curso
  newCourse = {
    titulo: '',
    descripcion: '',
    profesorId: '',
    imagen: ''
  };

  // Inscripción
  selectedStudents: string[] = [];

  // Preview y upload de imágenes
  imagePreviewCreate: string | null = null;
  imagePreviewEdit: string | null = null;
  uploadingImage = false;

  constructor(
    private courseService: CourseService,
    private userService: UserService,
    private authService: AuthService,
    private cloudinaryService: CloudinaryService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCursos();
    this.loadProfesores();
    this.loadEstudiantes();
  }

  loadCursos() {
    this.loading = true;
    this.courseService.getAllCourses().subscribe({
      next: async (courses) => {
        // Cargar nombre del profesor para cada curso
        const cursosConProfesor: CursoConProfesor[] = [];

        for (const course of courses) {
          const cursoExtendido: CursoConProfesor = { ...course };

          if (course.profesorId) {
            const profesor = await this.userService.getUserById(course.profesorId);
            cursoExtendido.profesorNombre = profesor ? `${profesor.nombre} ${profesor.apellido}` : 'Sin asignar';
          } else {
            cursoExtendido.profesorNombre = 'Sin asignar';
          }

          cursosConProfesor.push(cursoExtendido);
        }

        this.cursos = cursosConProfesor.sort((a, b) =>
          new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()
        );
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando cursos:', error);
        this.loading = false;
      }
    });
  }

  async loadProfesores() {
    this.profesores = await this.userService.getUsersByRole('profesor');
  }

  async loadEstudiantes() {
    this.estudiantes = await this.userService.getUsersByRole('estudiante');
  }

  applyFilters() {
    this.cursosFiltrados = this.cursos.filter(course => {
      const searchMatch = !this.searchTerm ||
        course.titulo.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        course.descripcion.toLowerCase().includes(this.searchTerm.toLowerCase());

      const statusMatch = this.filterStatus === 'todos' ||
        (this.filterStatus === 'activos' && course.activo) ||
        (this.filterStatus === 'inactivos' && !course.activo);

      return searchMatch && statusMatch;
    });
  }

  openCreateModal() {
    this.newCourse = {
      titulo: '',
      descripcion: '',
      profesorId: '',
      imagen: ''
    };
    this.imagePreviewCreate = null;
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.imagePreviewCreate = null;
  }

  async onImageSelectedCreate(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!this.cloudinaryService.isValidImageFile(file)) {
        return;
      }

      this.imagePreviewCreate = this.cloudinaryService.createImagePreview(file);

      try {
        this.uploadingImage = true;
        const imageUrl = await this.cloudinaryService.uploadImage(file);
        this.newCourse.imagen = imageUrl;
        this.uploadingImage = false;
      } catch (error) {
        console.error('Error subiendo imagen:', error);
        alert('Error al subir la imagen');
        this.imagePreviewCreate = null;
        this.uploadingImage = false;
      }
    }
  }

  async createCourse() {
    try {
      if (!this.newCourse.titulo || !this.newCourse.descripcion) {
        alert('Por favor completa todos los campos requeridos');
        return;
      }

      await this.courseService.createCourse({
        titulo: this.newCourse.titulo,
        descripcion: this.newCourse.descripcion,
        profesorId: this.newCourse.profesorId || '',
        imagen: this.newCourse.imagen || ''
      });

      alert('Curso creado exitosamente');
      this.closeCreateModal();
      this.loadCursos();
    } catch (error: any) {
      console.error('Error al crear curso:', error);
      alert('Error al crear curso: ' + (error.message || 'Error desconocido'));
    }
  }

  editCourse(course: Curso) {
    this.selectedCourse = { ...course };
    this.imagePreviewEdit = course.imagen || null;
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.imagePreviewEdit = null;
    this.selectedCourse = null;
  }

  async onImageSelectedEdit(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!this.cloudinaryService.isValidImageFile(file)) {
        return;
      }

      this.imagePreviewEdit = this.cloudinaryService.createImagePreview(file);

      try {
        this.uploadingImage = true;
        const imageUrl = await this.cloudinaryService.uploadImage(file);
        if (this.selectedCourse) {
          this.selectedCourse.imagen = imageUrl;
        }
        this.uploadingImage = false;
      } catch (error) {
        console.error('Error subiendo imagen:', error);
        alert('Error al subir la imagen');
        this.imagePreviewEdit = this.selectedCourse?.imagen || null;
        this.uploadingImage = false;
      }
    }
  }

  async saveCourse() {
    if (!this.selectedCourse) return;

    try {
      await this.courseService.updateCourse(this.selectedCourse.id, {
        titulo: this.selectedCourse.titulo,
        descripcion: this.selectedCourse.descripcion,
        profesorId: this.selectedCourse.profesorId,
        imagen: this.selectedCourse.imagen
      });
      this.closeEditModal();
      alert('Curso actualizado correctamente');
      this.loadCursos();
    } catch (error) {
      console.error('Error actualizando curso:', error);
      alert('Error al actualizar curso');
    }
  }

  async toggleStatus(course: Curso) {
    const action = course.activo ? 'desactivar' : 'activar';
    if (confirm(`¿Está seguro de ${action} el curso "${course.titulo}"?`)) {
      try {
        await this.courseService.toggleCourseStatus(course.id, !course.activo);
        this.loadCursos();
      } catch (error) {
        console.error('Error cambiando estado:', error);
        alert('Error al cambiar el estado');
      }
    }
  }

  async deleteCourse(course: Curso) {
    if (confirm(`¿Está seguro de eliminar el curso "${course.titulo}"? Esta acción no se puede deshacer.`)) {
      try {
        await this.courseService.deleteCourse(course.id);
        alert('Curso eliminado correctamente');
        this.loadCursos();
      } catch (error) {
        console.error('Error eliminando curso:', error);
        alert('Error al eliminar curso');
      }
    }
  }

  openEnrollModal(course: Curso) {
    this.selectedCourse = course;
    this.selectedStudents = [...course.estudiantes];
    this.showEnrollModal = true;
  }

  closeEnrollModal() {
    this.showEnrollModal = false;
    this.selectedCourse = null;
    this.selectedStudents = [];
  }

  toggleStudentSelection(studentId: string) {
    const index = this.selectedStudents.indexOf(studentId);
    if (index > -1) {
      this.selectedStudents.splice(index, 1);
    } else {
      this.selectedStudents.push(studentId);
    }
  }

  isStudentSelected(studentId: string): boolean {
    return this.selectedStudents.includes(studentId);
  }

  async saveEnrollment() {
    if (!this.selectedCourse) return;

    try {
      const currentStudents = this.selectedCourse.estudiantes;

      // Estudiantes a inscribir (nuevos)
      const toEnroll = this.selectedStudents.filter(id => !currentStudents.includes(id));

      // Estudiantes a desinscribir (removidos)
      const toUnenroll = currentStudents.filter(id => !this.selectedStudents.includes(id));

      // Inscribir nuevos
      for (const studentId of toEnroll) {
        await this.courseService.enrollStudent(this.selectedCourse.id, studentId);
      }

      // Desinscribir removidos
      for (const studentId of toUnenroll) {
        await this.courseService.unenrollStudent(this.selectedCourse.id, studentId);
      }

      alert('Inscripciones actualizadas correctamente');
      this.closeEnrollModal();
      this.loadCursos();
    } catch (error) {
      console.error('Error actualizando inscripciones:', error);
      alert('Error al actualizar inscripciones');
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  goToDashboard() {
    // Solo accesible para admins
    this.router.navigate(['/admin']);
  }

  viewSections(cursoId: string) {
    this.router.navigate(['/cursos', cursoId, 'secciones']);
  }

  verLibroCalificaciones(cursoId: string) {
    this.router.navigate(['/cursos', cursoId, 'calificaciones']);
  }

  configurarCalificaciones(cursoId: string) {
    this.router.navigate(['/cursos', cursoId, 'configurar-calificaciones']);
  }

  truncateText(text: string, maxLength: number = 80): string {
    if (!text) return '';
    return text.length > maxLength
      ? text.substring(0, maxLength) + '...'
      : text;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
