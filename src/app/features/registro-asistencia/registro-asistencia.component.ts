import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { CourseService } from '../../core/services/course.service';
import { AsistenciaService } from '../../core/services/asistencia.service';
import { AuthService } from '../../core/services/auth.service';
import { Curso } from '../../core/models/course.model';
import { User } from '../../core/models/user.model';
import { RegistroAsistenciaEstudiante, EstadoAsistencia, estadoATexto, normalizarFecha } from '../../core/models/asistencia.model';

@Component({
  selector: 'app-registro-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro-asistencia.component.html',
  styleUrl: './registro-asistencia.component.css'
})
export class RegistroAsistenciaComponent implements OnInit {
  curso: Curso | null = null;
  estudiantes: RegistroAsistenciaEstudiante[] = [];
  fechaSeleccionada: string | Date = new Date().toISOString().split('T')[0];
  existeRegistro: boolean = false;
  loading: boolean = true;
  guardando: boolean = false;
  currentUser: User | null = null;
  maxFecha: string = new Date().toISOString().split('T')[0]; // Fecha máxima = hoy
  minFecha: string; // Fecha mínima = 1 año atrás

  // Para mostrar los nombres de los estados
  estadoATexto = estadoATexto;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private courseService: CourseService,
    private asistenciaService: AsistenciaService,
    private authService: AuthService
  ) {
    // Calcular fecha mínima (1 año atrás desde hoy)
    const fechaMinima = new Date();
    fechaMinima.setFullYear(fechaMinima.getFullYear() - 1);
    this.minFecha = fechaMinima.toISOString().split('T')[0];
  }

  async ngOnInit() {
    this.currentUser = await this.authService.getCurrentUserProfile();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    const cursoId = this.route.snapshot.paramMap.get('cursoId');
    if (!cursoId) {
      alert('Curso no especificado');
      this.goBack();
      return;
    }

    await this.loadCurso(cursoId);
    await this.cargarRegistroAsistencia();
  }

  async loadCurso(cursoId: string) {
    try {
      this.curso = await this.courseService.getCourseById(cursoId);
      if (!this.curso) {
        alert('Curso no encontrado');
        this.goBack();
        return;
      }

      // Cargar estudiantes del curso
      await this.cargarEstudiantes();
    } catch (error) {
      console.error('Error cargando curso:', error);
      alert('Error al cargar el curso');
      this.goBack();
    }
  }

  async cargarEstudiantes() {
    if (!this.curso) return;

    this.estudiantes = [];

    // Obtener información de cada estudiante
    for (const estudianteId of this.curso.estudiantes) {
      const estudiante = await this.authService.getUserProfile(estudianteId);
      if (estudiante) {
        this.estudiantes.push({
          estudianteId: estudiante.id,
          nombreEstudiante: `${estudiante.nombre} ${estudiante.apellido}`,
          estado: undefined // Sin marcar por defecto
        });
      }
    }

    // Ordenar por nombre
    this.estudiantes.sort((a, b) =>
      a.nombreEstudiante.localeCompare(b.nombreEstudiante)
    );
  }

  async cargarRegistroAsistencia() {
    if (!this.curso) return;

    this.loading = true;

    try {
      // Verificar si existe registro para la fecha seleccionada
      const fecha = new Date(this.fechaSeleccionada);
      this.existeRegistro = await this.asistenciaService.existeRegistroDia(
        this.curso.id,
        fecha
      );

      if (this.existeRegistro) {
        // Cargar asistencias existentes
        const asistencias = await this.asistenciaService.getAsistenciasDia(
          this.curso.id,
          fecha
        );

        // Mapear asistencias a estudiantes
        asistencias.forEach(asistencia => {
          const estudiante = this.estudiantes.find(
            e => e.estudianteId === asistencia.estudianteId
          );
          if (estudiante) {
            estudiante.estado = asistencia.estado;
          }
        });
      } else {
        // Limpiar estados (todos en blanco)
        this.estudiantes.forEach(e => e.estado = undefined);
      }
    } catch (error) {
      console.error('Error cargando asistencia:', error);
      alert('Error al cargar el registro de asistencia');
    } finally {
      this.loading = false;
    }
  }

  async onFechaChange() {
    await this.cargarRegistroAsistencia();
  }

  marcarEstado(estudiante: RegistroAsistenciaEstudiante, estado: EstadoAsistencia) {
    // Si ya está marcado con el mismo estado, desmarcarlo
    if (estudiante.estado === estado) {
      estudiante.estado = undefined;
    } else {
      estudiante.estado = estado;
    }
  }

  async guardarAsistencias() {
    if (!this.curso || !this.currentUser) return;

    // Confirmación
    const confirmacion = confirm(
      this.existeRegistro
        ? '¿Deseas actualizar el registro de asistencia de este día?'
        : '¿Deseas guardar el registro de asistencia?\n\nNota: Los estudiantes sin marcar se guardarán como "Falta"'
    );

    if (!confirmacion) return;

    this.guardando = true;

    try {
      const fecha = new Date(this.fechaSeleccionada);
      await this.asistenciaService.registrarAsistenciasMasivas(
        this.curso.id,
        this.estudiantes,
        fecha,
        this.currentUser.id
      );

      alert('Asistencia guardada correctamente');

      // Recargar para mostrar el registro actualizado
      await this.cargarRegistroAsistencia();
    } catch (error) {
      console.error('Error guardando asistencia:', error);
      alert('Error al guardar la asistencia');
    } finally {
      this.guardando = false;
    }
  }

  marcarTodos(estado: EstadoAsistencia) {
    const confirmacion = confirm(`¿Marcar a todos como "${estadoATexto(estado)}"?`);
    if (confirmacion) {
      this.estudiantes.forEach(e => e.estado = estado);
    }
  }

  limpiarTodos() {
    const confirmacion = confirm('¿Limpiar todas las marcas?');
    if (confirmacion) {
      this.estudiantes.forEach(e => e.estado = undefined);
    }
  }

  esFechaPasada(): boolean {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaSelec = new Date(this.fechaSeleccionada);
    fechaSelec.setHours(0, 0, 0, 0);
    return fechaSelec < hoy;
  }

  getFechaFormateada(): string {
    const fecha = new Date(this.fechaSeleccionada);
    return fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getConteoEstados(): Record<EstadoAsistencia | 'sin_marcar', number> {
    const conteo: Record<EstadoAsistencia | 'sin_marcar', number> = {
      'P': 0,
      'T': 0,
      'F': 0,
      'J': 0,
      'sin_marcar': 0
    };

    this.estudiantes.forEach(e => {
      if (e.estado) {
        conteo[e.estado]++;
      } else {
        conteo['sin_marcar']++;
      }
    });

    return conteo;
  }

  goBack() {
        if (this.curso) {
      this.router.navigate(['/curso', this.curso.id]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
