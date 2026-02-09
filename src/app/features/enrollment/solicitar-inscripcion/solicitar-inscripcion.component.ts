import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CourseService } from '../../../core/services/course.service';
import { EnrollmentRequestService } from '../../../core/services/enrollment-request.service';
import { AuthService } from '../../../core/services/auth.service';
import { Curso } from '../../../core/models/course.model';
import { UserModel } from '../../../core/models/user.model';

@Component({
  selector: 'app-solicitar-inscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitar-inscripcion.component.html',
  styleUrl: './solicitar-inscripcion.component.scss'
})
export class SolicitarInscripcionComponent implements OnInit {
  cursos: Curso[] = [];
  cursoIdSeleccionado = '';
  cursoSeleccionado: Curso | null = null;
  loading = false;
  currentUser: UserModel | null = null;

  constructor(
    private courseService: CourseService,
    private enrollmentService: EnrollmentRequestService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    // Obtener usuario actual
    this.currentUser = await this.authService.getCurrentUserProfile();

    if (!this.currentUser) {
      alert('Debes iniciar sesión');
      this.router.navigate(['/login']);
      return;
    }

    // Cargar todos los cursos disponibles
    try {
      this.cursos = await firstValueFrom(this.courseService.getAllCourses());
    } catch (error) {
      console.error('Error cargando cursos:', error);
      alert('Error al cargar los cursos');
    }
  }

  onCursoChange() {
    // Actualizar curso seleccionado
    this.cursoSeleccionado = this.cursos.find(c => c.id === this.cursoIdSeleccionado) || null;
  }

  async enviarSolicitud() {
    if (!this.cursoSeleccionado || !this.currentUser) return;

    // Validar que no esté ya inscrito
    if (this.currentUser.cursosInscritos?.includes(this.cursoSeleccionado.id)) {
      alert('Ya estás inscrito en este curso');
      return;
    }

    // Validar que no tenga solicitud pendiente
    const hasPending = await this.enrollmentService.hasPendingRequest(
      this.currentUser.id,
      this.cursoSeleccionado.id
    );

    if (hasPending) {
      alert('Ya tienes una solicitud pendiente para este curso');
      return;
    }

    // Confirmar
    if (!confirm(`¿Deseas solicitar inscripción a "${this.cursoSeleccionado.titulo}"?`)) {
      return;
    }

    this.loading = true;
    try {
      await this.enrollmentService.createRequest(
        this.currentUser.id,
        `${this.currentUser.nombre} ${this.currentUser.apellido}`,
        this.currentUser.email,
        this.cursoSeleccionado.id,
        this.cursoSeleccionado.titulo
      );

      alert('¡Solicitud enviada! Te notificaremos cuando sea revisada.');
      this.router.navigate(['/estudiante/mis-solicitudes']);
    } catch (error) {
      console.error('Error enviando solicitud:', error);
      alert('Error al enviar la solicitud');
    } finally {
      this.loading = false;
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
