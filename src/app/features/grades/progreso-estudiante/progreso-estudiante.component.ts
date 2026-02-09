import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GradingService } from '../../../core/services/grading.service';
import { AuthService } from '../../../core/services/auth.service';
import { AsistenciaService } from '../../../core/services/asistencia.service';
import { ProgresoEstudiante, CalificacionEstudiante, ConfiguracionCalificacion } from '../../../core/models/grading.model';
import { Asistencia, EstadoAsistencia } from '../../../core/models/asistencia.model';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-progreso-estudiante',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progreso-estudiante.component.html',
  styleUrl: './progreso-estudiante.component.scss'
})
export class ProgresoEstudianteComponent implements OnInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  cursoId!: string;
  estudianteId!: string;
  progreso?: ProgresoEstudiante;
  calificacion?: CalificacionEstudiante;
  configuracion?: ConfiguracionCalificacion;
  asistencias: Asistencia[] = [];
  promedioAsistencia = 0;
  loading = false;
  cursoTitulo = '';
  chart?: Chart;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gradingService: GradingService,
    private authService: AuthService,
    private asistenciaService: AsistenciaService
  ) {}

  async ngOnInit(): Promise<void> {
    this.cursoId = this.route.snapshot.paramMap.get('cursoId')!;
    const estudianteIdParam = this.route.snapshot.paramMap.get('estudianteId');

    // Si no se proporciona estudianteId, usar el usuario actual
    if (estudianteIdParam) {
      this.estudianteId = estudianteIdParam;
    } else {
      const currentUser = await this.authService.getCurrentUser();
      this.estudianteId = currentUser?.uid || '';
    }

    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      // Cargar progreso, calificación y configuración en paralelo
      const [progreso, calificacion, configuracion] = await Promise.all([
        this.gradingService.calcularProgreso(this.estudianteId, this.cursoId),
        this.gradingService.calcularCalificacionEstudiante(this.estudianteId, this.cursoId),
        this.gradingService.getConfiguracionByCurso(this.cursoId)
      ]);

      this.progreso = progreso;
      this.calificacion = calificacion;
      this.configuracion = configuracion || undefined;

      // Cargar asistencias si la configuración lo incluye
      if (this.configuracion?.ponderacionAsistencia && this.configuracion.ponderacionAsistencia > 0) {
        this.asistencias = await this.asistenciaService.getAsistenciasEstudiante(this.cursoId, this.estudianteId);
        this.promedioAsistencia = await this.asistenciaService.calcularPromedioAsistencia(this.cursoId, this.estudianteId);
      }

      // Obtener título del curso
      // TODO: Agregar método en un servicio de cursos
      this.cursoTitulo = 'Curso';

      setTimeout(() => this.createChart(), 100);
    } catch (error) {
      console.error('Error al cargar progreso:', error);
      alert('Error al cargar el progreso. Asegúrate de que el curso tenga configuración de calificaciones.');
    } finally {
      this.loading = false;
    }
  }

  get porcentajeTareasCompletadas(): number {
    if (!this.progreso || this.progreso.tareasTotales === 0) return 0;
    return Math.round((this.progreso.tareasEntregadas.length / this.progreso.tareasTotales) * 100);
  }

  get porcentajeExamenesCompletados(): number {
    if (!this.progreso || this.progreso.examenesTotales === 0) return 0;
    return Math.round((this.progreso.examenesRealizados.length / this.progreso.examenesTotales) * 100);
  }

  get porcentajeAsistencia(): number {
    return Math.round(this.promedioAsistencia * 100);
  }

  get totalAsistencias(): number {
    return this.asistencias.length;
  }

  getEstadoAsistenciaTexto(estado: EstadoAsistencia): string {
    const textos: Record<EstadoAsistencia, string> = {
      'P': 'Presente',
      'T': 'Tardanza',
      'F': 'Falta',
      'J': 'Justificado'
    };
    return textos[estado];
  }

  getEstadoAsistenciaClase(estado: EstadoAsistencia): string {
    const clases: Record<EstadoAsistencia, string> = {
      'P': 'estado-presente',
      'T': 'estado-tarde',
      'F': 'estado-falta',
      'J': 'estado-justificado'
    };
    return clases[estado];
  }

  getEstadoAsistenciaIcono(estado: EstadoAsistencia): string {
    const iconos: Record<EstadoAsistencia, string> = {
      'P': 'fa-check-circle',
      'T': 'fa-clock',
      'F': 'fa-times-circle',
      'J': 'fa-exclamation-circle'
    };
    return iconos[estado];
  }

  getEstadoClase(): string {
    if (!this.calificacion) return '';
    switch (this.calificacion.estado) {
      case 'aprobado': return 'estado-aprobado';
      case 'desaprobado': return 'estado-desaprobado';
      case 'en_progreso': return 'estado-progreso';
      default: return '';
    }
  }

  getEstadoTexto(): string {
    if (!this.calificacion) return 'Sin calificar';
    switch (this.calificacion.estado) {
      case 'aprobado': return 'Aprobado';
      case 'desaprobado': return 'Desaprobado';
      case 'en_progreso': return 'En Progreso';
      default: return this.calificacion.estado;
    }
  }

  getEstadoIcono(): string {
    if (!this.calificacion) return 'fa-hourglass';
    switch (this.calificacion.estado) {
      case 'aprobado': return 'fa-check-circle';
      case 'desaprobado': return 'fa-times-circle';
      case 'en_progreso': return 'fa-hourglass-half';
      default: return 'fa-question-circle';
    }
  }

  getCalificacionClase(calificacion: number): string {
    if (calificacion >= 90) return 'cal-excelente';
    if (calificacion >= 75) return 'cal-bueno';
    if (calificacion >= 60) return 'cal-regular';
    return 'cal-desaprobado';
  }

  volver(): void {
    this.router.navigate(['/curso', this.cursoId]);
  }

  createChart(): void {
    if (!this.calificacion || !this.chartCanvas || !this.configuracion) return;

    // Destruir gráfico anterior si existe
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Determinar qué componentes incluir en el gráfico
    const labels: string[] = [];
    const data: number[] = [];
    const backgroundColor: string[] = [];
    const borderColor: string[] = [];

    // Siempre incluir tareas
    labels.push('Tareas');
    data.push(this.calificacion.promedioTareas);
    backgroundColor.push('rgba(25, 118, 210, 0.7)');
    borderColor.push('rgb(25, 118, 210)');

    // Siempre incluir exámenes
    labels.push('Exámenes');
    data.push(this.calificacion.promedioExamenes);
    backgroundColor.push('rgba(56, 142, 60, 0.7)');
    borderColor.push('rgb(56, 142, 60)');

    // Incluir asistencia si está configurada
    if (this.configuracion.ponderacionAsistencia && this.configuracion.ponderacionAsistencia > 0) {
      labels.push('Asistencia');
      data.push(this.porcentajeAsistencia);
      backgroundColor.push('rgba(255, 152, 0, 0.7)');
      borderColor.push('rgb(255, 152, 0)');
    }

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          label: 'Calificaciones',
          data: data,
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                size: 14
              },
              padding: 15
            }
          },
          title: {
            display: true,
            text: 'Comparación de Componentes',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }
}
