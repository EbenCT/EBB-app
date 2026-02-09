import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ExamService } from '../../core/services/exam.service';
import { Examen, IntentoExamen, Pregunta } from '../../core/models/exam.model';
import { Curso } from '../../core/models/course.model';

@Component({
  selector: 'app-resultado-examen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resultado-examen.component.html',
  styleUrl: './resultado-examen.component.scss'
})
export class ResultadoExamenComponent implements OnInit {
  examen?: Examen;
  intento?: IntentoExamen;
  examenId!: string;
  intentoId!: string;
  loading = true;

  constructor(
    private examService: ExamService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit(): Promise<void> {
    this.examenId = this.route.snapshot.paramMap.get('examenId')!;
    this.intentoId = this.route.snapshot.paramMap.get('intentoId')!;

    await this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      const [examen, intento] = await Promise.all([
        this.examService.getExamById(this.examenId),
        this.examService.getAttemptById(this.intentoId)
      ]);

      if (!examen || !intento) {
        alert('No se encontró el examen o intento');
        this.router.navigate(['/']);
        return;
      }

      this.examen = examen;
      this.intento = intento;
      this.loading = false;

    } catch (error) {
      console.error('Error loading results:', error);
      alert('Error al cargar los resultados');
      this.router.navigate(['/']);
    }
  }

  get aprobado(): boolean {
    if (!this.intento || !this.examen) return false;
    return (this.intento.calificacion || 0) >= this.examen.notaMinima;
  }

  get respuestasCorrectas(): number {
    return this.intento?.respuestas.filter(r => r.esCorrecta).length || 0;
  }

  get totalPreguntas(): number {
    return this.examen?.preguntas.length || 0;
  }

  getPregunta(preguntaId: string): Pregunta | undefined {
    return this.examen?.preguntas.find(p => p.id === preguntaId);
  }

  getRespuestaTexto(preguntaId: string): string {
    const respuesta = this.intento?.respuestas.find(r => r.preguntaId === preguntaId);
    const pregunta = this.getPregunta(preguntaId);

    if (!respuesta || !pregunta) return 'Sin respuesta';

    if (Array.isArray(respuesta.respuesta)) {
      const opciones = respuesta.respuesta.map(id => {
        const opcion = pregunta.opciones?.find(o => o.id === id);
        return opcion?.texto || id;
      });
      return opciones.join(', ');
    }

    // Para respuestas de opción múltiple, buscar el texto
    if (pregunta.opciones) {
      const opcion = pregunta.opciones.find(o => o.id === respuesta.respuesta);
      return opcion?.texto || respuesta.respuesta as string;
    }

    return respuesta.respuesta as string;
  }

  getRespuestaCorrectaTexto(preguntaId: string): string {
    const pregunta = this.getPregunta(preguntaId);
    if (!pregunta) return '';

    if (Array.isArray(pregunta.respuestaCorrecta)) {
      const opciones = pregunta.respuestaCorrecta.map(id => {
        const opcion = pregunta.opciones?.find(o => o.id === id);
        return opcion?.texto || id;
      });
      return opciones.join(', ');
    }

    // Para respuestas de opción múltiple, buscar el texto
    if (pregunta.opciones) {
      const opcion = pregunta.opciones.find(o => o.id === pregunta.respuestaCorrecta);
      return opcion?.texto || pregunta.respuestaCorrecta as string;
    }

    return pregunta.respuestaCorrecta as string;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDuracion(): string {
    if (!this.intento?.fechaInicio || !this.intento?.fechaFin) return 'N/A';

    const inicio = new Date(this.intento.fechaInicio).getTime();
    const fin = new Date(this.intento.fechaFin).getTime();
    const duracionMs = fin - inicio;
    const minutos = Math.floor(duracionMs / 60000);
    const segundos = Math.floor((duracionMs % 60000) / 1000);

    return `${minutos}m ${segundos}s`;
  }

  volver(): void {
    this.location.back();
  }
}
