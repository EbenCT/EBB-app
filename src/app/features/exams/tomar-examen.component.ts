import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamService } from '../../core/services/exam.service';
import { AuthService } from '../../core/services/auth.service';
import { Examen, Pregunta, IntentoExamen, RespuestaEstudiante, TipoPregunta } from '../../core/models/exam.model';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-tomar-examen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tomar-examen.component.html',
  styleUrl: './tomar-examen.component.scss'
})
export class TomarExamenComponent implements OnInit, OnDestroy {
  examen?: Examen;
  intento?: IntentoExamen;
  examenId!: string;
  currentUserId!: string;

  preguntasActuales: Pregunta[] = [];
  preguntaActualIndex = 0;
  respuestasForm!: FormGroup;

  // Timer
  tiempoRestante = 0; // en segundos
  timerSubscription?: Subscription;
  tiempoAgotado = false;

  // Estado
  loading = true;
  submitting = false;
  autoSaveInterval?: any;

  constructor(
    private fb: FormBuilder,
    private examService: ExamService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.examenId = this.route.snapshot.paramMap.get('id')!;
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Debes iniciar sesión para tomar el examen');
      this.router.navigate(['/login']);
      return;
    }
    this.currentUserId = currentUser.uid;

    await this.loadExamen();
    await this.verificarIntentosDisponibles();
    await this.iniciarIntento();
    this.initForm();
    this.startTimer();
    this.startAutoSave();
  }

  ngOnDestroy(): void {
    this.timerSubscription?.unsubscribe();
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }

  async loadExamen(): Promise<void> {
    try {
      const examen = await this.examService.getExamById(this.examenId);
      if (!examen) {
        alert('Examen no encontrado');
        this.router.navigate(['/']);
        return;
      }

      // Verificar que el examen esté disponible
      if (!this.examService.isExamAvailable(examen)) {
        alert('Este examen no está disponible en este momento');
        this.router.navigate(['/']);
        return;
      }

      this.examen = examen;

      // Mezclar preguntas si está configurado
      this.preguntasActuales = examen.mezclarPreguntas
        ? this.examService.shuffleQuestions(examen.preguntas)
        : [...examen.preguntas];

    } catch (error) {
      console.error('Error loading exam:', error);
      alert('Error al cargar el examen');
      this.router.navigate(['/']);
    }
  }

  async verificarIntentosDisponibles(): Promise<void> {
    if (!this.examen) return;

    const intentos = await this.examService.getAttemptsByStudentAndExam(
      this.currentUserId,
      this.examenId
    );

    const intentosFinalizados = intentos.filter(i => i.estado === 'finalizado').length;

    if (intentosFinalizados >= this.examen.intentosPermitidos) {
      alert(`Has alcanzado el límite de ${this.examen.intentosPermitidos} intentos para este examen`);
      this.router.navigate(['/']);
      return;
    }
  }

  async iniciarIntento(): Promise<void> {
    if (!this.examen) return;

    try {
      const intentos = await this.examService.getAttemptsByStudentAndExam(
        this.currentUserId,
        this.examenId
      );

      const numeroIntento = intentos.length + 1;

      // Crear nuevo intento
      const intentoData: Omit<IntentoExamen, 'id'> = {
        examenId: this.examenId,
        estudianteId: this.currentUserId,
        numeroIntento,
        fechaInicio: new Date(),
        respuestas: [],
        estado: 'en_progreso'
      };

      const intentoId = await this.examService.createAttempt(intentoData);

      this.intento = {
        id: intentoId,
        ...intentoData
      };

      // Calcular tiempo restante
      this.tiempoRestante = this.examen.duracionMinutos * 60;
      this.loading = false;

    } catch (error) {
      console.error('Error creating attempt:', error);
      alert('Error al iniciar el examen');
      this.router.navigate(['/']);
    }
  }

  initForm(): void {
    const controls: any = {};

    this.preguntasActuales.forEach(pregunta => {
      if (pregunta.tipo === 'multiple_multiple') {
        // Para múltiples respuestas, crear controles para cada opción
        pregunta.opciones?.forEach(opcion => {
          controls[`${pregunta.id}_${opcion.id}`] = [false];
        });
      } else {
        controls[pregunta.id] = ['', Validators.required];
      }
    });

    this.respuestasForm = this.fb.group(controls);
  }

  startTimer(): void {
    this.timerSubscription = interval(1000).subscribe(() => {
      if (this.tiempoRestante > 0) {
        this.tiempoRestante--;
      } else {
        this.tiempoAgotado = true;
        this.submitExam(true);
      }
    });
  }

  startAutoSave(): void {
    // Guardar progreso cada 30 segundos
    this.autoSaveInterval = setInterval(() => {
      this.saveProgress();
    }, 30000);
  }

  async saveProgress(): Promise<void> {
    if (!this.intento) return;

    try {
      const respuestas = this.buildRespuestas();
      await this.examService.updateAttempt(this.intento.id, {
        respuestas
      });
    } catch (error) {
      console.error('Error auto-saving:', error);
    }
  }

  get preguntaActual(): Pregunta {
    return this.preguntasActuales[this.preguntaActualIndex];
  }

  get preguntasRespondidas(): number {
    return this.preguntasActuales.filter(p => this.isPreguntaRespondida(p)).length;
  }

  get progreso(): number {
    return (this.preguntasRespondidas / this.preguntasActuales.length) * 100;
  }

  isPreguntaRespondida(pregunta: Pregunta): boolean {
    if (pregunta.tipo === 'multiple_multiple') {
      return pregunta.opciones?.some(opcion => {
        const control = this.respuestasForm.get(`${pregunta.id}_${opcion.id}`);
        return control?.value === true;
      }) || false;
    } else {
      const control = this.respuestasForm.get(pregunta.id);
      return control ? !!control.value : false;
    }
  }

  getFormControlName(preguntaId: string, opcionId?: string): string {
    return opcionId ? `${preguntaId}_${opcionId}` : preguntaId;
  }

  navegarPregunta(index: number): void {
    if (index >= 0 && index < this.preguntasActuales.length) {
      this.preguntaActualIndex = index;
    }
  }

  anterior(): void {
    if (this.preguntaActualIndex > 0) {
      this.preguntaActualIndex--;
    }
  }

  siguiente(): void {
    if (this.preguntaActualIndex < this.preguntasActuales.length - 1) {
      this.preguntaActualIndex++;
    }
  }

  buildRespuestas(): RespuestaEstudiante[] {
    const respuestas: RespuestaEstudiante[] = [];

    this.preguntasActuales.forEach(pregunta => {
      let respuesta: string | string[];

      if (pregunta.tipo === 'multiple_multiple') {
        // Recopilar todas las opciones marcadas
        respuesta = [];
        pregunta.opciones?.forEach(opcion => {
          const control = this.respuestasForm.get(`${pregunta.id}_${opcion.id}`);
          if (control?.value === true) {
            (respuesta as string[]).push(opcion.id);
          }
        });
      } else {
        const control = this.respuestasForm.get(pregunta.id);
        respuesta = control?.value || '';
      }

      respuestas.push({
        preguntaId: pregunta.id,
        respuesta
      });
    });

    return respuestas;
  }

  async submitExam(porTiempoAgotado = false): Promise<void> {
    if (this.submitting) return;

    if (!porTiempoAgotado) {
      const confirmacion = confirm('¿Está seguro de enviar el examen? Esta acción no se puede deshacer.');
      if (!confirmacion) return;
    }

    if (!this.examen || !this.intento) return;

    try {
      this.submitting = true;
      this.timerSubscription?.unsubscribe();
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
      }

      const respuestas = this.buildRespuestas();

      // Finalizar y calificar
      const calificacion = await this.examService.finishAttempt(
        this.intento.id,
        this.examen,
        respuestas
      );

      // Actualizar estado si fue por tiempo agotado
      if (porTiempoAgotado) {
        await this.examService.updateAttempt(this.intento.id, {
          estado: 'tiempo_agotado'
        });
      }

      // Mostrar resultado
      const aprobado = calificacion >= this.examen.notaMinima;
      const mensaje = porTiempoAgotado
        ? `Tiempo agotado. Calificación: ${calificacion.toFixed(2)}%`
        : `Examen enviado. Calificación: ${calificacion.toFixed(2)}%\n${aprobado ? '¡Aprobado!' : 'No aprobado'}`;

      alert(mensaje);

      // Redirigir a resultados
      this.router.navigate(['/examenes', this.examenId, 'resultados', this.intento.id]);

    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Error al enviar el examen');
      this.submitting = false;
    }
  }

  formatTime(segundos: number): string {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;

    if (horas > 0) {
      return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    }
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  }

  get timerClass(): string {
    if (this.tiempoRestante <= 60) return 'critical';
    if (this.tiempoRestante <= 300) return 'warning';
    return 'normal';
  }
}
