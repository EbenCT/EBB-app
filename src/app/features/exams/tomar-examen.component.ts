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
    // Si loadExamen redirigió por examen no disponible, no continuar
    if (!this.examen) return;

    const puedeContinuar = await this.verificarIntentosDisponibles();
    if (!puedeContinuar) return;

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

  /**
   * 🆕 Devuelve true si el estudiante todavía puede rendir.
   * Cuenta tanto intentos FINALIZADOS como TIEMPO_AGOTADO (intentos
   * realmente consumidos). Los 'en_progreso' NO consumen intento: se
   * reutilizan en iniciarIntento(), evitando registros fantasma.
   */
  async verificarIntentosDisponibles(): Promise<boolean> {
    if (!this.examen) return false;

    const intentos = await this.examService.getAttemptsByStudentAndExam(
      this.currentUserId,
      this.examenId
    );

    const intentosConsumidos = intentos.filter(
      i => i.estado === 'finalizado' || i.estado === 'tiempo_agotado'
    ).length;

    if (intentosConsumidos >= this.examen.intentosPermitidos) {
      alert(`Has alcanzado el límite de ${this.examen.intentosPermitidos} intentos para este examen`);
      this.router.navigate(['/']);
      return false;
    }

    return true;
  }

  /**
   * 🆕 Reutiliza un intento 'en_progreso' existente si lo hay, en lugar de
   * crear siempre uno nuevo. Esto elimina el doble registro fantasma que
   * aparecía al recargar la página o reconectar durante el examen.
   */
  async iniciarIntento(): Promise<void> {
    if (!this.examen) return;

    try {
      const intentos = await this.examService.getAttemptsByStudentAndExam(
        this.currentUserId,
        this.examenId
      );

      // ¿Hay un intento en progreso para reanudar?
      const enProgreso = intentos.find(i => i.estado === 'en_progreso');

      if (enProgreso) {
        // Reanudar el intento existente (no se crea uno nuevo)
        this.intento = enProgreso;
      } else {
        // Crear un nuevo intento solo si no hay ninguno en progreso
        const intentosConsumidos = intentos.filter(
          i => i.estado === 'finalizado' || i.estado === 'tiempo_agotado'
        ).length;
        const numeroIntento = intentosConsumidos + 1;

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
      }

      // Calcular tiempo restante en base a la fecha de inicio real del intento
      const duracionSegundos = this.examen.duracionMinutos * 60;
      const inicio = this.intento.fechaInicio instanceof Date
        ? this.intento.fechaInicio
        : new Date(this.intento.fechaInicio);
      const transcurridos = Math.floor((Date.now() - inicio.getTime()) / 1000);
      this.tiempoRestante = Math.max(0, duracionSegundos - transcurridos);

      this.loading = false;

    } catch (error: any) {
      console.error('Error creating attempt:', error);
      await this.examService.logExamError({
        contexto: 'iniciarIntento',
        examenId: this.examenId,
        estudianteId: this.currentUserId,
        mensaje: error?.message || String(error),
        codigo: error?.code
      });
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

    // 🆕 Si reanudamos un intento, restaurar las respuestas ya guardadas
    this.restaurarRespuestasGuardadas();
  }

  /**
   * 🆕 Vuelca al formulario las respuestas previamente autoguardadas
   * del intento en progreso (si las hubiera).
   */
  private restaurarRespuestasGuardadas(): void {
    const previas = this.intento?.respuestas;
    if (!previas || previas.length === 0) return;

    previas.forEach(r => {
      const pregunta = this.preguntasActuales.find(p => p.id === r.preguntaId);
      if (!pregunta) return;

      if (pregunta.tipo === 'multiple_multiple') {
        const seleccionadas = Array.isArray(r.respuesta) ? r.respuesta : [];
        pregunta.opciones?.forEach(opcion => {
          const control = this.respuestasForm.get(`${pregunta.id}_${opcion.id}`);
          if (control) {
            control.setValue(seleccionadas.includes(opcion.id));
          }
        });
      } else {
        const control = this.respuestasForm.get(pregunta.id);
        if (control && typeof r.respuesta === 'string') {
          control.setValue(r.respuesta);
        }
      }
    });
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

      // 🆕 Guardar las respuestas ANTES de calificar, de modo que aunque
      // falle el cierre, el trabajo del alumno no se pierda.
      try {
        await this.examService.updateAttempt(this.intento.id, { respuestas });
      } catch (saveErr) {
        // No abortamos: finishAttempt reintentará la escritura completa.
        console.warn('No se pudo pre-guardar respuestas, se intentará al finalizar:', saveErr);
      }

      // Finalizar y calificar (con refresh de token + reintentos dentro del servicio)
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

    } catch (error: any) {
      console.error('Error submitting exam:', error);

      // 🆕 Registrar el error real en Firestore para diagnóstico posterior
      await this.examService.logExamError({
        contexto: 'submitExam',
        examenId: this.examenId,
        intentoId: this.intento?.id,
        estudianteId: this.currentUserId,
        mensaje: error?.message || String(error),
        codigo: error?.code
      });

      // 🆕 Mensaje más claro y reactivar el botón para reintentar sin recargar
      const sinConexion = typeof navigator !== 'undefined' && navigator.onLine === false;
      alert(
        sinConexion
          ? 'No se pudo enviar el examen por falta de conexión. Tus respuestas quedaron guardadas; revisa tu internet y vuelve a pulsar "Enviar Examen".'
          : 'Error al enviar el examen. Tus respuestas quedaron guardadas; vuelve a pulsar "Enviar Examen" para reintentar.'
      );

      // Reactivar timer/autosave y botón para permitir un reintento limpio
      this.submitting = false;
      if (!porTiempoAgotado) {
        this.startAutoSave();
      }
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
