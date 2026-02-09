import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExamService } from '../../core/services/exam.service';
import { UserService } from '../../core/services/user.service';
import { Examen, IntentoExamen } from '../../core/models/exam.model';

interface IntentoConEstudiante extends IntentoExamen {
  nombreEstudiante?: string;
  emailEstudiante?: string;
}

@Component({
  selector: 'app-lista-intentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-intentos.component.html',
  styleUrls: ['./lista-intentos.component.scss']
})
export class ListaIntentosComponent implements OnInit {
  seccionId: string = '';
  examenId: string = '';
  examen: Examen | null = null;
  intentos: IntentoConEstudiante[] = [];
  loading: boolean = true;

  // Para editar calificación
  editingIntento: string | null = null;
  nuevaCalificacion: number = 0;

  // Filtros
  filtroEstado: string = 'todos';
  filtroBusqueda: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private examService: ExamService,
    private userService: UserService
  ) {}

  async ngOnInit(): Promise<void> {
    this.seccionId = this.route.snapshot.paramMap.get('seccionId') || '';
    this.examenId = this.route.snapshot.paramMap.get('examenId') || '';

    if (this.seccionId && this.examenId) {
      await this.loadData();
    }
  }

  async loadData(): Promise<void> {
    try {
      this.loading = true;

      // Cargar examen
      this.examen = await this.examService.getExamById(this.examenId);

      // Cargar intentos
      const intentos = await this.examService.getAttemptsByExam(this.examenId);

      // Cargar información de estudiantes
      this.intentos = await Promise.all(
        intentos.map(async (intento) => {
          const estudiante = await this.userService.getUserById(intento.estudianteId);
          return {
            ...intento,
            nombreEstudiante: estudiante?.nombre || 'Desconocido',
            emailEstudiante: estudiante?.email || ''
          };
        })
      );

    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar los intentos');
    } finally {
      this.loading = false;
    }
  }

  get intentosFiltrados(): IntentoConEstudiante[] {
    let filtrados = [...this.intentos];

    // Filtro por estado
    if (this.filtroEstado !== 'todos') {
      filtrados = filtrados.filter(i => i.estado === this.filtroEstado);
    }

    // Filtro por búsqueda (nombre o email)
    if (this.filtroBusqueda.trim()) {
      const busqueda = this.filtroBusqueda.toLowerCase();
      filtrados = filtrados.filter(i =>
        i.nombreEstudiante?.toLowerCase().includes(busqueda) ||
        i.emailEstudiante?.toLowerCase().includes(busqueda)
      );
    }

    return filtrados;
  }

  // Estadísticas
  get estadisticas() {
    const total = this.intentos.length;
    const finalizados = this.intentos.filter(i => i.estado === 'finalizado').length;
    const enProgreso = this.intentos.filter(i => i.estado === 'en_progreso').length;
    const tiempoAgotado = this.intentos.filter(i => i.estado === 'tiempo_agotado').length;

    const calificaciones = this.intentos
      .filter(i => i.calificacion !== undefined)
      .map(i => i.calificacion || 0);

    const promedio = calificaciones.length > 0
      ? calificaciones.reduce((sum, cal) => sum + cal, 0) / calificaciones.length
      : 0;

    const aprobados = calificaciones.filter(cal => cal >= (this.examen?.notaMinima || 60)).length;

    return {
      total,
      finalizados,
      enProgreso,
      tiempoAgotado,
      promedio,
      aprobados,
      porcentajeAprobacion: calificaciones.length > 0
        ? (aprobados / calificaciones.length) * 100
        : 0
    };
  }

  verRespuestas(intentoId: string): void {
    this.router.navigate(['/examenes', this.examenId, 'resultados', intentoId]);
  }

  iniciarEdicionCalificacion(intento: IntentoConEstudiante): void {
    this.editingIntento = intento.id || null;
    this.nuevaCalificacion = intento.calificacion || 0;
  }

  cancelarEdicion(): void {
    this.editingIntento = null;
    this.nuevaCalificacion = 0;
  }

  async guardarCalificacion(intentoId: string): Promise<void> {
    if (this.nuevaCalificacion < 0 || this.nuevaCalificacion > 100) {
      alert('La calificación debe estar entre 0 y 100');
      return;
    }

    if (!confirm('¿Está seguro de modificar esta calificación?')) {
      return;
    }

    try {
      await this.examService.updateAttemptGrade(intentoId, this.nuevaCalificacion);

      // Actualizar localmente
      const intento = this.intentos.find(i => i.id === intentoId);
      if (intento) {
        intento.calificacion = this.nuevaCalificacion;
      }

      this.editingIntento = null;
      alert('Calificación actualizada exitosamente');
    } catch (error) {
      console.error('Error actualizando calificación:', error);
      alert('Error al actualizar la calificación');
    }
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'finalizado': return 'estado-finalizado';
      case 'en_progreso': return 'estado-progreso';
      case 'tiempo_agotado': return 'estado-agotado';
      default: return '';
    }
  }

  getEstadoTexto(estado: string): string {
    switch (estado) {
      case 'finalizado': return 'Finalizado';
      case 'en_progreso': return 'En Progreso';
      case 'tiempo_agotado': return 'Tiempo Agotado';
      default: return estado;
    }
  }

  getCalificacionClass(calificacion: number): string {
    const notaMinima = this.examen?.notaMinima || 60;
    return calificacion >= notaMinima ? 'aprobado' : 'reprobado';
  }

  volver(): void {
    this.router.navigate(['/secciones', this.seccionId, 'examenes']);
  }

  exportarResultados(): void {
    // TODO: Implementar exportación a Excel
    alert('Funcionalidad de exportación próximamente');
  }
}
