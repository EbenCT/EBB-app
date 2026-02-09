import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { GradingService } from '../../../core/services/grading.service';
import { LibroCalificaciones, FilaLibroCalificaciones } from '../../../core/models/grading.model';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-libro-calificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './libro-calificaciones.component.html',
  styleUrl: './libro-calificaciones.component.scss'
})
export class LibroCalificacionesComponent implements OnInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  cursoId!: string;
  libro?: LibroCalificaciones;
  loading = false;
  filtroEstado: 'todos' | 'aprobado' | 'desaprobado' | 'en_progreso' = 'todos';
  busqueda = '';
  chart?: Chart;
  mostrarGrafico = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gradingService: GradingService
  ) {}

  ngOnInit(): void {
    this.cursoId = this.route.snapshot.paramMap.get('cursoId')!;
    this.loadLibro();
  }

  async loadLibro(): Promise<void> {
    this.loading = true;
    try {
      this.libro = await this.gradingService.getLibroCalificaciones(this.cursoId);
      setTimeout(() => this.createChart(), 100);
    } catch (error) {
      console.error('Error al cargar libro de calificaciones:', error);
      alert('Error al cargar las calificaciones. Asegúrate de configurar las ponderaciones primero.');
    } finally {
      this.loading = false;
    }
  }

  get estudiantesFiltrados(): FilaLibroCalificaciones[] {
    if (!this.libro) return [];

    let resultado = this.libro.estudiantes;

    // Filtrar por estado
    if (this.filtroEstado !== 'todos') {
      resultado = resultado.filter(e => e.estado === this.filtroEstado);
    }

    // Filtrar por búsqueda
    if (this.busqueda) {
      const termino = this.busqueda.toLowerCase();
      resultado = resultado.filter(e =>
        e.nombreEstudiante.toLowerCase().includes(termino) ||
        e.email.toLowerCase().includes(termino)
      );
    }

    return resultado;
  }

  getEstadoClase(estado: string): string {
    switch (estado) {
      case 'aprobado': return 'badge-aprobado';
      case 'desaprobado': return 'badge-desaprobado';
      case 'en_progreso': return 'badge-progreso';
      default: return '';
    }
  }

  getEstadoTexto(estado: string): string {
    switch (estado) {
      case 'aprobado': return 'Aprobado';
      case 'desaprobado': return 'Desaprobado';
      case 'en_progreso': return 'En Progreso';
      default: return estado;
    }
  }

  getCalificacionClase(calificacion: number | null): string {
    if (!this.libro || calificacion === null) return '';

    const escala = this.libro.configuracion.escalaCalificacion;

    if (calificacion >= (escala.excelente || 90)) return 'cal-excelente';
    if (calificacion >= (escala.bueno || 75)) return 'cal-bueno';
    if (calificacion >= (escala.regular || 60)) return 'cal-regular';
    return 'cal-desaprobado';
  }

  configurar(): void {
    this.router.navigate(['/cursos', this.cursoId, 'configurar-calificaciones']);
  }

  exportarExcel(): void {
    if (!this.libro) return;

    // Crear hoja de cálculo con los datos del libro
    const datos = this.libro.estudiantes.map(est => {
      const fila: any = {
        'Nombre': est.nombreEstudiante,
        'Email': est.email
      };

      // Agregar calificaciones de tareas y exámenes
      this.libro!.columnas.forEach(col => {
        if (col.tipo === 'tarea') {
          fila[col.titulo] = est.tareas[col.id] !== null ? est.tareas[col.id] : 'N/A';
        } else if (col.tipo === 'examen') {
          fila[col.titulo] = est.examenes[col.id] !== null ? est.examenes[col.id] : 'N/A';
        }
      });

      fila['Promedio Tareas'] = est.promedioTareas.toFixed(2);
      fila['Promedio Exámenes'] = est.promedioExamenes.toFixed(2);
      fila['Calificación Final'] = est.calificacionFinal.toFixed(2);
      fila['Estado'] = this.getEstadoTexto(est.estado);

      return fila;
    });

    // Crear workbook
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');

    // Crear hoja de estadísticas
    const stats = this.estadisticas;
    if (stats) {
      const statsData = [
        { Métrica: 'Total de Estudiantes', Valor: stats.total },
        { Métrica: 'Aprobados', Valor: stats.aprobados },
        { Métrica: 'Desaprobados', Valor: stats.desaprobados },
        { Métrica: 'En Progreso', Valor: stats.enProgreso },
        { Métrica: 'Promedio General', Valor: stats.promedio.toFixed(2) },
        { Métrica: 'Tasa de Aprobación (%)', Valor: stats.tasaAprobacion }
      ];
      const wsStats = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, wsStats, 'Estadísticas');
    }

    // Exportar archivo
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fecha = new Date().toISOString().split('T')[0];
    saveAs(blob, `libro-calificaciones-${fecha}.xlsx`);
  }

  createChart(): void {
    if (!this.libro || !this.chartCanvas) return;

    // Destruir gráfico anterior si existe
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Distribución de calificaciones por rangos
    const rangos = {
      'Excelente (90-100)': 0,
      'Bueno (75-89)': 0,
      'Regular (60-74)': 0,
      'Desaprobado (<60)': 0
    };

    this.libro.estudiantes.forEach(est => {
      const cal = est.calificacionFinal;
      if (cal >= 90) rangos['Excelente (90-100)']++;
      else if (cal >= 75) rangos['Bueno (75-89)']++;
      else if (cal >= 60) rangos['Regular (60-74)']++;
      else rangos['Desaprobado (<60)']++;
    });

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: Object.keys(rangos),
        datasets: [{
          label: 'Número de Estudiantes',
          data: Object.values(rangos),
          backgroundColor: [
            'rgba(40, 167, 69, 0.7)',
            'rgba(23, 162, 184, 0.7)',
            'rgba(255, 193, 7, 0.7)',
            'rgba(220, 53, 69, 0.7)'
          ],
          borderColor: [
            'rgb(40, 167, 69)',
            'rgb(23, 162, 184)',
            'rgb(255, 193, 7)',
            'rgb(220, 53, 69)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Distribución de Calificaciones',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            title: {
              display: true,
              text: 'Estudiantes'
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  toggleGrafico(): void {
    this.mostrarGrafico = !this.mostrarGrafico;
  }

  verProgreso(estudianteId: string): void {
    this.router.navigate(['/cursos', this.cursoId, 'estudiantes', estudianteId, 'progreso']);
  }

  volver(): void {
    this.router.navigate(['/cursos', this.cursoId]);
  }

  get estadisticas() {
    if (!this.libro) return null;

    const total = this.libro.estudiantes.length;
    const aprobados = this.libro.estudiantes.filter(e => e.estado === 'aprobado').length;
    const desaprobados = this.libro.estudiantes.filter(e => e.estado === 'desaprobado').length;
    const enProgreso = this.libro.estudiantes.filter(e => e.estado === 'en_progreso').length;
    const promedio = total > 0
      ? this.libro.estudiantes.reduce((sum, e) => sum + e.calificacionFinal, 0) / total
      : 0;

    return {
      total,
      aprobados,
      desaprobados,
      enProgreso,
      promedio: Math.round(promedio * 100) / 100,
      tasaAprobacion: total > 0 ? Math.round((aprobados / total) * 100) : 0
    };
  }
}
