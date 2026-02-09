import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { CourseService } from '../../../core/services/course.service';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  userName: string = '';
  stats = {
    totalUsuarios: 0,
    totalCursos: 0,
    totalEstudiantes: 0,
    totalProfesores: 0
  };
  loading = true;
  cursosConCalificaciones: any[] = [];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private courseService: CourseService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.userProfile$.subscribe(profile => {
      if (profile) {
        this.userName = profile.nombre + ' ' + profile.apellido;
        this.cargarEstadisticas();
      }
    });
  }

  async cargarEstadisticas() {
    try {
      this.loading = true;

      // Obtener estadísticas de usuarios
      const userStats = await this.userService.getUserStats();

      // Obtener estadísticas de cursos
      const courseStats = await this.courseService.getCourseStats();

      // Obtener cursos para calificaciones
      this.cursosConCalificaciones = await firstValueFrom(this.courseService.getAllCourses());

      // Actualizar estadísticas
      this.stats = {
        totalUsuarios: userStats.total,
        totalCursos: courseStats.cursosActivos,
        totalEstudiantes: userStats.estudiantes,
        totalProfesores: userStats.profesores
      };

      this.loading = false;
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      this.loading = false;
    }
  }

  navegarA(ruta: string) {
    this.router.navigate([ruta]);
  }

  verLibroCalificaciones(cursoId: string) {
    this.router.navigate(['/cursos', cursoId, 'calificaciones']);
  }

  configurarCalificaciones(cursoId: string) {
    this.router.navigate(['/cursos', cursoId, 'configurar-calificaciones']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
