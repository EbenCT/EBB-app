import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy, Timestamp, addDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Examen, Pregunta, IntentoExamen, RespuestaEstudiante } from '../models/exam.model';
import { ProgressUnlockService } from './progress-unlock.service';

@Injectable({
  providedIn: 'root'
})
export class ExamService {
  private examenesCollection = collection(this.firestore, 'examenes');
  private intentosCollection = collection(this.firestore, 'intentos');

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private progressUnlockService: ProgressUnlockService
  ) {}

  /**
   * Crear nuevo examen
   */
  async createExam(examen: Omit<Examen, 'id'>): Promise<string> {
    const docRef = doc(this.examenesCollection);
    const examenData = {
      ...examen,
      fechaInicio: Timestamp.fromDate(examen.fechaInicio),
      fechaFin: Timestamp.fromDate(examen.fechaFin),
      fechaCreacion: Timestamp.fromDate(examen.fechaCreacion)
    };
    await setDoc(docRef, examenData);
    return docRef.id;
  }

  /**
   * Obtener examen por ID
   */
  async getExamById(examenId: string): Promise<Examen | null> {
    const docRef = doc(this.firestore, 'examenes', examenId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        fechaInicio: data['fechaInicio']?.toDate(),
        fechaFin: data['fechaFin']?.toDate(),
        fechaCreacion: data['fechaCreacion']?.toDate()
      } as Examen;
    }
    return null;
  }

  /**
   * Obtener exámenes de una sección
   */
  async getExamsBySection(seccionId: string): Promise<Examen[]> {
    const q = query(
      this.examenesCollection,
      where('seccionId', '==', seccionId),
      orderBy('fechaCreacion', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaInicio: data['fechaInicio']?.toDate(),
        fechaFin: data['fechaFin']?.toDate(),
        fechaCreacion: data['fechaCreacion']?.toDate()
      } as Examen;
    });
  }

  /**
   * Actualizar examen
   */
  async updateExam(examenId: string, examen: Partial<Examen>): Promise<void> {
    const docRef = doc(this.firestore, 'examenes', examenId);
    const updateData: any = { ...examen };

    if (examen.fechaInicio) {
      updateData.fechaInicio = Timestamp.fromDate(examen.fechaInicio);
    }
    if (examen.fechaFin) {
      updateData.fechaFin = Timestamp.fromDate(examen.fechaFin);
    }
    if (examen.fechaCreacion) {
      updateData.fechaCreacion = Timestamp.fromDate(examen.fechaCreacion);
    }

    await updateDoc(docRef, updateData);
  }

  /**
   * Eliminar examen
   */
  async deleteExam(examenId: string): Promise<void> {
    const docRef = doc(this.firestore, 'examenes', examenId);
    await deleteDoc(docRef);
  }

  /**
   * Verificar si un examen está disponible
   */
  isExamAvailable(examen: Examen): boolean {
    const now = new Date();
    return examen.fechaInicio <= now && examen.fechaFin >= now;
  }

  /**
   * Crear intento de examen
   */
  async createAttempt(intento: Omit<IntentoExamen, 'id'>): Promise<string> {
    const intentoData = {
      ...intento,
      fechaInicio: Timestamp.fromDate(intento.fechaInicio),
      fechaFin: intento.fechaFin ? Timestamp.fromDate(intento.fechaFin) : null
    };
    const docRef = await addDoc(this.intentosCollection, intentoData);
    return docRef.id;
  }

  /**
   * Obtener intentos de un estudiante para un examen
   */
  async getAttemptsByStudentAndExam(estudianteId: string, examenId: string): Promise<IntentoExamen[]> {
    const q = query(
      this.intentosCollection,
      where('estudianteId', '==', estudianteId),
      where('examenId', '==', examenId),
      orderBy('numeroIntento', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaInicio: data['fechaInicio']?.toDate(),
        fechaFin: data['fechaFin']?.toDate()
      } as IntentoExamen;
    });
  }

  /**
   * Obtener intento por ID
   */
  async getAttemptById(intentoId: string): Promise<IntentoExamen | null> {
    const docRef = doc(this.firestore, 'intentos', intentoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        fechaInicio: data['fechaInicio']?.toDate(),
        fechaFin: data['fechaFin']?.toDate()
      } as IntentoExamen;
    }
    return null;
  }

  /**
   * Actualizar intento
   */
  async updateAttempt(intentoId: string, intento: Partial<IntentoExamen>): Promise<void> {
    const docRef = doc(this.firestore, 'intentos', intentoId);
    const updateData: any = { ...intento };

    if (intento.fechaInicio) {
      updateData.fechaInicio = Timestamp.fromDate(intento.fechaInicio);
    }
    if (intento.fechaFin) {
      updateData.fechaFin = Timestamp.fromDate(intento.fechaFin);
    }

    await updateDoc(docRef, updateData);
  }

  /**
   * 🆕 Refrescar el token de autenticación de forma segura.
   * En exámenes largos el token puede caducar; forzar el refresh
   * antes de una escritura crítica evita rechazos de Firestore.
   */
  private async refreshAuthToken(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (user) {
        await user.getIdToken(true);
      }
    } catch (e) {
      // Si falla el refresh, dejamos que la escritura lo intente igual.
      console.warn('No se pudo refrescar el token de auth:', e);
    }
  }

  /**
   * 🆕 Reintentar una operación con backoff exponencial.
   * Cubre fallos transitorios de red móvil al enviar el examen.
   */
  private async retry<T>(fn: () => Promise<T>, intentos = 3, esperaMs = 800): Promise<T> {
    let ultimoError: any;
    for (let i = 0; i < intentos; i++) {
      try {
        return await fn();
      } catch (error) {
        ultimoError = error;
        // Esperar antes de reintentar (backoff: 800ms, 1600ms, ...)
        if (i < intentos - 1) {
          await new Promise(res => setTimeout(res, esperaMs * (i + 1)));
        }
      }
    }
    throw ultimoError;
  }

  /**
   * Finalizar intento y calificar
   *
   * 🆕 CAMBIOS:
   * - La comparación de opción múltiple ahora resuelve por id de forma
   *   robusta y, si el id no se encuentra, cae a comparación por texto.
   * - Se "congela" en cada respuesta el texto elegido y el texto correcto,
   *   para que la pantalla de resultados no dependa de re-buscar por id
   *   en el examen (inmune a colisiones o cambios posteriores del examen).
   * - La escritura final se hace con refresh de token + reintentos.
   */
  async finishAttempt(intentoId: string, examen: Examen, respuestas: RespuestaEstudiante[]): Promise<number> {
    // Calificar respuestas
    let puntosObtenidos = 0;
    const totalPuntos = examen.preguntas.reduce((sum, p) => sum + p.puntos, 0);

    const respuestasCalificadas: RespuestaEstudiante[] = respuestas.map(respuesta => {
      const pregunta = examen.preguntas.find(p => p.id === respuesta.preguntaId);
      if (!pregunta) return respuesta;

      let esCorrecta = false;
      let puntos = 0;

      switch (pregunta.tipo) {
        case 'multiple_unica':
        case 'verdadero_falso':
          esCorrecta = this.compararOpcionUnica(
            respuesta.respuesta as string,
            pregunta
          );
          break;

        case 'corta':
        case 'completar':
          esCorrecta = this.compararRespuestas(respuesta.respuesta, pregunta.respuestaCorrecta);
          break;

        case 'multiple_multiple':
          esCorrecta = this.compararRespuestasMultiples(
            (respuesta.respuesta as string[]) || [],
            (pregunta.respuestaCorrecta as string[]) || [],
            pregunta
          );
          break;
      }

      if (esCorrecta) {
        puntos = pregunta.puntos;
        puntosObtenidos += puntos;
      }

      // 🆕 Congelar textos legibles dentro de la propia respuesta del intento
      const textoRespuesta = this.resolverTextoRespuesta(respuesta.respuesta, pregunta);
      const textoCorrecto = this.resolverTextoCorrecto(pregunta);

      return {
        ...respuesta,
        esCorrecta,
        puntosObtenidos: puntos,
        textoRespuesta,
        textoCorrecto
      } as RespuestaEstudiante;
    });

    // Calcular calificación sobre 100
    const calificacion = totalPuntos > 0 ? (puntosObtenidos / totalPuntos) * 100 : 0;

    // 🆕 Refrescar token antes de la escritura crítica
    await this.refreshAuthToken();

    // 🆕 Actualizar intento con reintentos ante fallos transitorios de red
    await this.retry(() =>
      this.updateAttempt(intentoId, {
        respuestas: respuestasCalificadas,
        calificacion,
        fechaFin: new Date(),
        estado: 'finalizado'
      })
    );

    // 🆕 ACTUALIZAR PROGRESO DEL ESTUDIANTE (no crítico)
    try {
      const intentoDoc = await getDoc(doc(this.firestore, 'intentos', intentoId));
      if (intentoDoc.exists()) {
        const intentoData = intentoDoc.data() as IntentoExamen;
        if (intentoData.estudianteId && examen.seccionId) {
          await this.progressUnlockService.actualizarProgresoEstudiante(
            examen.seccionId,
            intentoData.estudianteId
          );
          console.log('✅ Progreso actualizado tras completar examen');
        }
      }
    } catch (progressError) {
      console.warn('⚠️ Error actualizando progreso (no crítico):', progressError);
    }

    return calificacion;
  }

  /**
   * 🆕 Comparar respuesta de opción única / verdadero-falso.
   * Primero intenta por id. Si la opción elegida o la correcta no se
   * resuelven por id (p. ej. colisión o id ausente), compara por texto.
   */
  private compararOpcionUnica(respuestaId: string, pregunta: Pregunta): boolean {
    const correctaId = pregunta.respuestaCorrecta as string;

    // Comparación directa por id (caso normal)
    if (respuestaId && correctaId && respuestaId === correctaId) {
      return true;
    }

    // Fallback robusto: comparar por texto de la opción
    const opcionElegida = pregunta.opciones?.find(o => o.id === respuestaId);
    const opcionCorrectaPorId = pregunta.opciones?.find(o => o.id === correctaId);
    const opcionCorrectaPorFlag = pregunta.opciones?.find(o => o.esCorrecta === true);

    const textoElegido = opcionElegida?.texto;
    const textoCorrecto = (opcionCorrectaPorId || opcionCorrectaPorFlag)?.texto;

    if (textoElegido && textoCorrecto) {
      return this.normalizarTexto(textoElegido) === this.normalizarTexto(textoCorrecto);
    }

    return false;
  }

  /**
   * Comparar respuestas simples (corta / completar)
   */
  private compararRespuestas(respuesta: string | string[], correcta: string | string[]): boolean {
    if (typeof respuesta === 'string' && typeof correcta === 'string') {
      return this.normalizarTexto(respuesta) === this.normalizarTexto(correcta);
    }
    return false;
  }

  /**
   * Comparar respuestas múltiples.
   * 🆕 Intenta por ids y, si no cuadran por id, cae a comparación por texto.
   */
  private compararRespuestasMultiples(respuestas: string[], correctas: string[], pregunta?: Pregunta): boolean {
    // Comparación por id
    if (respuestas.length === correctas.length) {
      const respuestasOrdenadas = [...respuestas].sort();
      const correctasOrdenadas = [...correctas].sort();
      const coincidenIds = respuestasOrdenadas.every((r, i) => r === correctasOrdenadas[i]);
      if (coincidenIds) return true;
    }

    // Fallback por texto
    if (pregunta?.opciones) {
      const textoElegidas = respuestas
        .map(id => pregunta.opciones?.find(o => o.id === id)?.texto)
        .filter((t): t is string => !!t)
        .map(t => this.normalizarTexto(t))
        .sort();

      const textoCorrectas = (pregunta.opciones || [])
        .filter(o => correctas.includes(o.id) || o.esCorrecta === true)
        .map(o => this.normalizarTexto(o.texto))
        .sort();

      if (
        textoElegidas.length > 0 &&
        textoElegidas.length === textoCorrectas.length &&
        textoElegidas.every((t, i) => t === textoCorrectas[i])
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * 🆕 Normalizar texto para comparaciones tolerantes
   * (acentos Unicode, mayúsculas, espacios internos/extremos).
   */
  private normalizarTexto(s: string): string {
    return (s || '')
      .normalize('NFC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 🆕 Resolver el texto legible de la respuesta del estudiante.
   */
  private resolverTextoRespuesta(respuesta: string | string[], pregunta: Pregunta): string {
    if (Array.isArray(respuesta)) {
      return respuesta
        .map(id => pregunta.opciones?.find(o => o.id === id)?.texto || id)
        .join(', ');
    }
    if (pregunta.opciones && pregunta.opciones.length > 0) {
      const opcion = pregunta.opciones.find(o => o.id === respuesta);
      return opcion?.texto || (respuesta as string) || 'Sin respuesta';
    }
    return (respuesta as string) || 'Sin respuesta';
  }

  /**
   * 🆕 Resolver el texto legible de la respuesta correcta.
   */
  private resolverTextoCorrecto(pregunta: Pregunta): string {
    const correcta = pregunta.respuestaCorrecta;
    if (Array.isArray(correcta)) {
      return correcta
        .map(id => pregunta.opciones?.find(o => o.id === id)?.texto || id)
        .join(', ');
    }
    if (pregunta.opciones && pregunta.opciones.length > 0) {
      const opcion = pregunta.opciones.find(o => o.id === correcta)
        || pregunta.opciones.find(o => o.esCorrecta === true);
      return opcion?.texto || (correcta as string) || '';
    }
    return (correcta as string) || '';
  }

  /**
   * Obtener todos los intentos de un examen (para profesor)
   */
  async getAttemptsByExam(examenId: string): Promise<IntentoExamen[]> {
    const q = query(
      this.intentosCollection,
      where('examenId', '==', examenId),
      orderBy('fechaInicio', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaInicio: data['fechaInicio']?.toDate(),
        fechaFin: data['fechaFin']?.toDate()
      } as IntentoExamen;
    });
  }

  /**
   * Mezclar preguntas aleatoriamente
   */
  shuffleQuestions(preguntas: Pregunta[]): Pregunta[] {
    const shuffled = [...preguntas];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generar ID único para pregunta
   * 🆕 Usa crypto.randomUUID cuando está disponible para garantizar unicidad.
   */
  generateQuestionId(): string {
    return `pregunta_${this.uuid()}`;
  }

  /**
   * 🆕 Generador de identificadores únicos robusto.
   * Evita las colisiones de Math.random().toString(36).substr(2,9).
   */
  private uuid(): string {
    const c: any = (globalThis as any)?.crypto;
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID();
    }
    // Fallback: timestamp + dos segmentos aleatorios de longitud fija
    const rnd = () => Math.random().toString(36).slice(2).padEnd(9, '0').slice(0, 9);
    return `${Date.now().toString(36)}-${rnd()}-${rnd()}`;
  }

  /**
   * 🆕 Registrar un error de examen en Firestore para diagnóstico.
   * Útil porque los errores ocurren en el navegador del alumno y no
   * aparecen en logs de servidor (Vercel).
   */
  async logExamError(payload: {
    contexto: string;
    examenId?: string;
    intentoId?: string;
    estudianteId?: string;
    mensaje: string;
    codigo?: string;
  }): Promise<void> {
    try {
      const ref = collection(this.firestore, 'errores_examenes');
      await addDoc(ref, {
        ...payload,
        online: typeof navigator !== 'undefined' ? navigator.onLine : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        fecha: Timestamp.now()
      });
    } catch (e) {
      // El logging nunca debe romper el flujo del usuario.
      console.warn('No se pudo registrar el error de examen:', e);
    }
  }

  /**
   * Actualizar calificación manualmente (solo profesor/admin)
   */
  async updateAttemptGrade(intentoId: string, nuevaCalificacion: number): Promise<void> {
    const docRef = doc(this.firestore, 'intentos', intentoId);
    await updateDoc(docRef, {
      calificacion: nuevaCalificacion,
      calificacionModificadaManualmente: true,
      fechaModificacionCalificacion: Timestamp.now()
    });
  }
}
