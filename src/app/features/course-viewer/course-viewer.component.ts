import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { CourseService } from '../../core/services/course.service';
import { SectionService } from '../../core/services/section.service';
import { LessonService } from '../../core/services/lesson.service';
import { TaskService } from '../../core/services/task.service';
import { ExamService } from '../../core/services/exam.service';
import { AuthService } from '../../core/services/auth.service';
import { ProgressUnlockService } from '../../core/services/progress-unlock.service';
import { Curso } from '../../core/models/course.model';
import { Seccion, ElementoSeccion, ProgresoSeccion } from '../../core/models/section.model';
import { Leccion } from '../../core/models/lesson.model';
import { Tarea, EntregaTarea } from '../../core/models/task.model';
import { Examen, IntentoExamen } from '../../core/models/exam.model';
import { marked } from 'marked';

interface SeccionExpandida extends Seccion {
  expanded: boolean;
  lecciones: LeccionConTareas[];
  examenesData: ExamenConIntentos[];
  progreso?: ProgresoSeccion;
}

interface ExamenConIntentos extends Examen {
  intentosUsuario: IntentoExamen[];
  disponible: boolean;
  intentosRestantes: number;
}

interface LeccionConTareas extends Leccion {
  tareasData: Tarea[]; // Array completo de objetos Tarea (diferente de tareas: string[])
  expanded: boolean; // Para expandir/colapsar lista de tareas
}

@Component({
  selector: 'app-course-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-viewer.component.html',
  styleUrl: './course-viewer.component.scss'
})
export class CourseViewerComponent implements OnInit {
  curso: Curso | null = null;
  secciones: SeccionExpandida[] = [];
  currentUser: any = null;
  userRole: string = '';
  loading: boolean = true;
  sidebarOpen: boolean = false; // Para controlar menú en móviles

  // Modal de retroalimentación
  preguntaRetroalimentacion: { texto: string; opcionCorrecta: string; opcionIncorrecta: string } | null = null;
  opcion1: string = '';
  opcion2: string = '';
  respuestaSeleccionada: string | null = null;
  mostrarErrorRetroalimentacion: boolean = false;
  leccionPendienteCompletar: Leccion | null = null;

  // Contenido actual
  contenidoActual: {
    tipo: 'leccion' | 'tarea' | 'examen' | null;
    seccionTitulo: string;
    elemento: Leccion | Tarea | ExamenConIntentos | null;
    entrega?: EntregaTarea | null;
  } = {
    tipo: null,
    seccionTitulo: '',
    elemento: null
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private courseService: CourseService,
    private sectionService: SectionService,
    private lessonService: LessonService,
    private taskService: TaskService,
    private examService: ExamService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private progressUnlockService: ProgressUnlockService
  ) {}

  /**
   * Helper para convertir Firestore Timestamps a Date
   */
  private convertTimestamp(timestamp: any): Date {
    return timestamp instanceof Date ? timestamp : timestamp.toDate();
  }

  async ngOnInit() {
    const firebaseUser = this.authService.getCurrentUser();
    if (!firebaseUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Obtener el perfil completo del usuario con el rol
    this.currentUser = await this.authService.getCurrentUserProfile();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.userRole = this.currentUser.rol;

    const cursoId = this.route.snapshot.paramMap.get('cursoId');
    if (!cursoId) {
      alert('Curso no especificado');
      this.goBack();
      return;
    }

    await this.loadCurso(cursoId);
  }

  async loadCurso(cursoId: string) {
    this.loading = true;
    try {
      // Cargar curso
      this.curso = await this.courseService.getCourseById(cursoId);
      if (!this.curso) {
        alert('Curso no encontrado');
        this.goBack();
        return;
      }

      // Cargar secciones
      const seccionesData = await firstValueFrom(this.sectionService.getSectionsByCourse(cursoId));

      // Obtener estado de progreso si el usuario es estudiante
      let estadoSecciones: Map<string, ProgresoSeccion> | undefined;
      if (this.userRole === 'estudiante') {
        estadoSecciones = await this.progressUnlockService.getEstadoSeccionesCurso(
          cursoId,
          this.currentUser.id
        );
      }

      // ✅ OPTIMIZACIÓN: Pre-cargar TODAS las lecciones y tareas en batch
      const allLeccionIds: string[] = [];
      const allTareaIds: string[] = [];

      seccionesData.forEach(seccion => {
        seccion.elementos
          .filter(el => el.tipo === 'leccion')
          .forEach(el => allLeccionIds.push(el.id));
      });

      // Batch loading de TODAS las lecciones (1 query en lugar de N)
      const leccionesMap = await this.lessonService.getLessonsByIds(allLeccionIds);

      // Recolectar IDs de tareas de todas las lecciones
      leccionesMap.forEach(leccion => {
        if (leccion.tareas) {
          allTareaIds.push(...leccion.tareas);
        }
      });

      // Batch loading de TODAS las tareas (1 query en lugar de N×M)
      const tareasMap = await this.taskService.getTasksByIds(allTareaIds);

      // Cargar lecciones y exámenes de cada sección
      this.secciones = await Promise.all(
        seccionesData.map(async (seccion) => {
          // Construir lecciones desde el mapa pre-cargado
          const lecciones: LeccionConTareas[] = await Promise.all(
            seccion.elementos
              .filter(elemento => elemento.tipo === 'leccion')
              .map(async (elemento) => {
                const leccion = leccionesMap.get(elemento.id);
                if (!leccion) return null;

                // Obtener tareas de esta lección desde el mapa pre-cargado
                const tareasIds = leccion.tareas || [];
                const tareasData: Tarea[] = tareasIds
                  .map(tareaId => {
                    const tarea = tareasMap.get(tareaId);
                    if (!tarea) return null;

                    // Filtrar visibilidad para estudiantes
                    if (this.userRole === 'estudiante' && tarea.visible === false) {
                      return null;
                    }

                    return {
                      ...tarea,
                      fechaInicio: this.convertTimestamp(tarea.fechaInicio),
                      fechaFin: this.convertTimestamp(tarea.fechaFin)
                    };
                  })
                  .filter((t): t is Tarea => t !== null);

                // Cargar estado de completado de la lección (solo para estudiantes)
                if (this.userRole === 'estudiante') {
                  const progresoLeccion = await this.progressUnlockService.getProgresoLeccion(
                    leccion.id,
                    this.currentUser.id
                  );
                  leccion.completada = progresoLeccion?.completada || false;
                  leccion.fechaCompletado = progresoLeccion?.fechaCompletado;
                }

                return {
                  ...leccion,
                  tareasData,
                  expanded: false
                };
              })
          ).then(lecciones => lecciones.filter((l): l is LeccionConTareas => l !== null));

          // Cargar exámenes de esta sección
          const examenesData: ExamenConIntentos[] = await this.loadExamenesSeccion(seccion.id);

          // Obtener progreso de esta sección
          const progreso = estadoSecciones?.get(seccion.id);

          return {
            ...seccion,
            expanded: false,
            lecciones,
            examenesData,
            progreso
          };
        })
      );

      // Cargar automáticamente la primera lección de la primera sección (si no está bloqueada)
      if (this.secciones.length > 0 && this.secciones[0].lecciones.length > 0) {
        const primeraSeccion = this.secciones[0];
        if (!primeraSeccion.progreso?.bloqueada || this.userRole !== 'estudiante') {
          primeraSeccion.expanded = true;
          await this.loadLeccion(primeraSeccion, primeraSeccion.lecciones[0]);
        }
      }

    } catch (error) {
      console.error('Error cargando curso:', error);
      alert('Error al cargar el curso');
    } finally {
      this.loading = false;
    }
  }

  async toggleSeccion(seccion: SeccionExpandida) {
    // Verificar si está bloqueada y es estudiante
    if (this.userRole === 'estudiante' && seccion.progreso?.bloqueada) {
      const mensaje = await this.progressUnlockService.getMensajeBloqueo(
        seccion.id,
        this.currentUser.id,
        this.secciones
      );
      alert(mensaje);
      return;
    }
    seccion.expanded = !seccion.expanded;
  }

  toggleLeccion(leccion: LeccionConTareas) {
    leccion.expanded = !leccion.expanded;
  }

  async loadLeccion(seccion: SeccionExpandida, leccion: LeccionConTareas) {
    // Verificar si la sección está bloqueada para estudiantes
    if (this.userRole === 'estudiante' && seccion.progreso?.bloqueada) {
      const mensaje = await this.progressUnlockService.getMensajeBloqueo(
        seccion.id,
        this.currentUser.id,
        this.secciones
      );
      alert(mensaje);
      return;
    }

    this.contenidoActual = {
      tipo: 'leccion',
      seccionTitulo: seccion.titulo,
      elemento: leccion,
      entrega: null
    };
    this.closeSidebarOnMobile(); // Cerrar sidebar en móviles
  }

  async loadTarea(seccion: SeccionExpandida, tarea: Tarea) {
    // Verificar si la sección está bloqueada para estudiantes
    if (this.userRole === 'estudiante' && seccion.progreso?.bloqueada) {
      const mensaje = await this.progressUnlockService.getMensajeBloqueo(
        seccion.id,
        this.currentUser.id,
        this.secciones
      );
      alert(mensaje);
      return;
    }

    this.contenidoActual = {
      tipo: 'tarea',
      seccionTitulo: seccion.titulo,
      elemento: tarea,
      entrega: null
    };

    // Si es estudiante, cargar su entrega
    if (this.userRole === 'estudiante') {
      this.contenidoActual.entrega = await this.taskService.getSubmissionByStudentAndTask(
        this.currentUser.id,
        tarea.id
      );

      if (this.contenidoActual.entrega?.fechaEntrega) {
        this.contenidoActual.entrega.fechaEntrega = this.convertTimestamp(
          this.contenidoActual.entrega.fechaEntrega
        );
      }
    }
    this.closeSidebarOnMobile(); // Cerrar sidebar en móviles
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebarOnMobile() {
    // Solo cerrar automáticamente en móviles (ancho < 768px)
    if (window.innerWidth < 768) {
      this.sidebarOpen = false;
    }
  }

  getLeccionActual(): Leccion | null {
    if (this.contenidoActual.tipo === 'leccion') {
      return this.contenidoActual.elemento as Leccion;
    }
    return null;
  }

  getTareaActual(): Tarea | null {
    if (this.contenidoActual.tipo === 'tarea') {
      return this.contenidoActual.elemento as Tarea;
    }
    return null;
  }

  getExamenActual(): ExamenConIntentos | null {
    if (this.contenidoActual.tipo === 'examen') {
      return this.contenidoActual.elemento as ExamenConIntentos;
    }
    return null;
  }

  getYoutubeEmbedUrl(url: string): SafeResourceUrl {
    if (!url) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('');
    }

    const videoId = this.extractYoutubeVideoId(url);
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : '';

    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  getSafePdfUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private extractYoutubeVideoId(url: string): string | null {
    if (!url) return null;

    // Intentar diferentes patrones de URL de YouTube
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    // https://www.youtube.com/v/VIDEO_ID
    // https://youtube.com/live/VIDEO_ID

    let videoId = null;

    // Patrón para URLs completas
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/live\/)([^#&?\n]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Si es solo el ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        videoId = match[1];
        break;
      }
    }

    return videoId;
  }

  entregarTarea(tareaId: string) {
    this.router.navigate(['/tareas', tareaId, 'entregar'], {
      queryParams: { cursoId: this.curso?.id }
    });
  }

  verEntregas(tareaId: string) {
    this.router.navigate(['/tareas', tareaId, 'entregas']);
  }

  goToDashboard() {
    if (this.userRole === 'profesor') {
      this.router.navigate(['/profesor']);
    } else if (this.userRole === 'estudiante') {
      this.router.navigate(['/estudiante']);
    } else {
      this.router.navigate(['/admin']);
    }
  }

  goBack() {
    this.goToDashboard();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  isTaskOverdue(tarea: Tarea): boolean {
    if (!tarea.fechaFin) return false;
    return new Date(tarea.fechaFin) < new Date();
  }

  async loadExamenesSeccion(seccionId: string): Promise<ExamenConIntentos[]> {
    try {
      const examenes = await this.examService.getExamsBySection(seccionId);

      // Filtrar exámenes visibles para estudiantes
      const examenesFiltrados = this.userRole === 'estudiante'
        ? examenes.filter(e => e.visible !== false)
        : examenes;

      // Para cada examen, obtener los intentos del usuario actual (si es estudiante)
      const examenesConIntentos: ExamenConIntentos[] = await Promise.all(
        examenesFiltrados.map(async (examen) => {
          let intentosUsuario: IntentoExamen[] = [];

          if (this.userRole === 'estudiante') {
            intentosUsuario = await this.examService.getAttemptsByStudentAndExam(
              this.currentUser.id,
              examen.id
            );
          }

          const disponible = this.examService.isExamAvailable(examen);
          const intentosRealizados = intentosUsuario.filter(i => i.estado === 'finalizado').length;
          const intentosRestantes = examen.intentosPermitidos - intentosRealizados;

          return {
            ...examen,
            intentosUsuario,
            disponible,
            intentosRestantes
          };
        })
      );

      return examenesConIntentos;
    } catch (error) {
      console.error('Error cargando exámenes de la sección:', error);
      return [];
    }
  }

  async loadExamen(seccion: SeccionExpandida, examen: ExamenConIntentos) {
    // Verificar si la sección está bloqueada para estudiantes
    if (this.userRole === 'estudiante' && seccion.progreso?.bloqueada) {
      const mensaje = await this.progressUnlockService.getMensajeBloqueo(
        seccion.id,
        this.currentUser.id,
        this.secciones
      );
      alert(mensaje);
      return;
    }

    this.contenidoActual = {
      tipo: 'examen',
      seccionTitulo: seccion.titulo,
      elemento: examen,
      entrega: null
    };
    this.closeSidebarOnMobile();
  }

  tomarExamen(examenId: string) {
    this.router.navigate(['/examenes', examenId, 'tomar']);
  }

  verResultadosExamen(examenId: string, intentoId: string) {
    this.router.navigate(['/examenes', examenId, 'resultados', intentoId]);
  }

  verIntentosExamen(examenId: string) {
    // Obtener seccionId del examen actual desde contenidoActual
    let seccionId: string | undefined;

    // Buscar en las secciones expandidas
    for (const seccion of this.secciones) {
      if (seccion.examenesData?.some((e: ExamenConIntentos) => e.id === examenId)) {
        seccionId = seccion.id;
        break;
      }
    }

    if (seccionId) {
      this.router.navigate(['/secciones', seccionId, 'examenes', examenId, 'intentos']);
    } else {
      console.error('No se encontró la sección para el examen:', examenId);
      alert('Error: No se pudo determinar la sección del examen');
    }
  }

  isExamenDisponible(examen: ExamenConIntentos): boolean {
    return examen.disponible && examen.intentosRestantes > 0;
  }

  getEstadoExamen(examen: ExamenConIntentos): string {
    if (!examen.disponible) {
      const ahora = new Date();
      if (ahora < examen.fechaInicio) return 'Próximamente';
      if (ahora > examen.fechaFin) return 'Cerrado';
    }
    if (examen.intentosRestantes <= 0) return 'Sin intentos';
    return 'Disponible';
  }

  getMejorCalificacion(examen: ExamenConIntentos): number | null {
    const intentosFinalizados = examen.intentosUsuario.filter(i => i.estado === 'finalizado' && i.calificacion !== undefined);
    if (intentosFinalizados.length === 0) return null;
    return Math.max(...intentosFinalizados.map(i => i.calificacion!));
  }

  // Verificar si el usuario es profesor o admin
  isProfesorOrAdmin(): boolean {
    return this.userRole === 'profesor' || this.userRole === 'admin';
  }

  // Navegación a calificaciones
  verLibroCalificaciones(): void {
    if (!this.curso?.id) return;
    this.router.navigate(['/cursos', this.curso.id, 'calificaciones']);
  }

  configurarCalificaciones(): void {
    if (!this.curso?.id) return;
    this.router.navigate(['/cursos', this.curso.id, 'configurar-calificaciones']);
  }

  registrarAsistencia(): void {
    if (!this.curso?.id) return;
    this.router.navigate(['/cursos', this.curso.id, 'asistencia']);
  }

  verMiProgreso(): void {
    if (!this.curso?.id) return;
    this.router.navigate(['/cursos', this.curso.id, 'progreso']);
  }

  // Completar lección
  async completarLeccion(leccion: Leccion): Promise<void> {
    if (!this.currentUser) return;

    // Si la lección tiene pregunta de retroalimentación, mostrar modal primero
    if (leccion.preguntaRetroalimentacion) {
      this.mostrarModalRetroalimentacion(leccion);
      return;
    }

    // Si no hay pregunta, completar directamente
    await this.marcarLeccionComoCompletada(leccion, null, null);
  }

  // Mostrar modal de retroalimentación
  mostrarModalRetroalimentacion(leccion: Leccion): void {
    if (!leccion.preguntaRetroalimentacion) return;

    this.leccionPendienteCompletar = leccion;
    this.preguntaRetroalimentacion = leccion.preguntaRetroalimentacion;
    this.respuestaSeleccionada = null;
    this.mostrarErrorRetroalimentacion = false;

    // Mezclar las opciones aleatoriamente
    const opciones = [
      leccion.preguntaRetroalimentacion.opcionCorrecta,
      leccion.preguntaRetroalimentacion.opcionIncorrecta
    ];
    const mezcladas = opciones.sort(() => Math.random() - 0.5);
    this.opcion1 = mezcladas[0];
    this.opcion2 = mezcladas[1];

    // Abrir modal usando Bootstrap
    const modalElement = document.getElementById('modalRetroalimentacion');
    if (modalElement) {
      const modal = new (window as any).bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  seleccionarRespuesta(opcion: string): void {
    this.respuestaSeleccionada = opcion;
    this.mostrarErrorRetroalimentacion = false;
  }

  async validarRetroalimentacion(): Promise<void> {
    if (!this.leccionPendienteCompletar || !this.respuestaSeleccionada || !this.preguntaRetroalimentacion) return;

    const esCorrecta = this.respuestaSeleccionada === this.preguntaRetroalimentacion.opcionCorrecta;

    if (esCorrecta) {
      // Cerrar modal
      const modalElement = document.getElementById('modalRetroalimentacion');
      if (modalElement) {
        const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
      }

      // Completar lección
      await this.marcarLeccionComoCompletada(
        this.leccionPendienteCompletar,
        this.respuestaSeleccionada,
        true
      );

      this.leccionPendienteCompletar = null;
    } else {
      // Mostrar error
      this.mostrarErrorRetroalimentacion = true;
    }
  }

  // Marcar lección como completada (con o sin retroalimentación)
  private async marcarLeccionComoCompletada(
    leccion: Leccion,
    respuestaRetroalimentacion: string | null,
    correctaRetroalimentacion: boolean | null
  ): Promise<void> {
    try {
      await this.progressUnlockService.marcarLeccionCompletada(
        leccion.id,
        this.currentUser.id,
        respuestaRetroalimentacion || undefined,
        correctaRetroalimentacion ?? undefined
      );

      // Actualizar estado local
      leccion.completada = true;
      leccion.fechaCompletado = new Date();
      if (respuestaRetroalimentacion) {
        leccion.respuestaRetroalimentacion = respuestaRetroalimentacion;
        leccion.correctaRetroalimentacion = correctaRetroalimentacion || false;
      }

      alert('¡Lección completada exitosamente!');

      // Invalidar caché de progreso para recalcular
      if (this.curso?.id) {
        await this.progressUnlockService.invalidarCacheProgresoCurso(this.curso.id, this.currentUser.id);

        // Recargar el progreso de la sección actual para actualizar el porcentaje en el sidebar
        const seccionActual = this.secciones.find(s =>
          s.lecciones.some(l => l.id === leccion.id)
        );
        if (seccionActual) {
          const progresoActualizado = await this.progressUnlockService.calcularProgresoSeccion(
            seccionActual.id,
            this.currentUser.id
          );
          seccionActual.progreso = progresoActualizado;
        }
      }
    } catch (error) {
      console.error('Error completando lección:', error);
      alert('Hubo un error al marcar la lección como completada. Intenta nuevamente.');
    }
  }

  /**
   * Convertir Markdown a HTML y sanitizar
   */
  getMarkdownHTML(markdown: string): SafeHtml {
    if (!markdown) return this.sanitizer.sanitize(1, '') || '';

    // Configurar marked para soportar saltos de línea y listas
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    try {
      const html = marked(markdown);
      return this.sanitizer.sanitize(1, html as string) || '';
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return this.sanitizer.sanitize(1, markdown) || '';
    }
  }
}
