import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, orderBy, Timestamp, addDoc } from '@angular/fire/firestore';
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
   * Finalizar intento y calificar
   */
  async finishAttempt(intentoId: string, examen: Examen, respuestas: RespuestaEstudiante[]): Promise<number> {
    // Calificar respuestas
    let puntosObtenidos = 0;
    const totalPuntos = examen.preguntas.reduce((sum, p) => sum + p.puntos, 0);

    const respuestasCalificadas = respuestas.map(respuesta => {
      const pregunta = examen.preguntas.find(p => p.id === respuesta.preguntaId);
      if (!pregunta) return respuesta;

      let esCorrecta = false;
      let puntos = 0;

      switch (pregunta.tipo) {
        case 'multiple_unica':
        case 'verdadero_falso':
        case 'corta':
        case 'completar':
          esCorrecta = this.compararRespuestas(respuesta.respuesta, pregunta.respuestaCorrecta);
          break;

        case 'multiple_multiple':
          esCorrecta = this.compararRespuestasMultiples(
            respuesta.respuesta as string[],
            pregunta.respuestaCorrecta as string[]
          );
          break;
      }

      if (esCorrecta) {
        puntos = pregunta.puntos;
        puntosObtenidos += puntos;
      }

      return {
        ...respuesta,
        esCorrecta,
        puntosObtenidos: puntos
      };
    });

    // Calcular calificación sobre 100
    const calificacion = totalPuntos > 0 ? (puntosObtenidos / totalPuntos) * 100 : 0;

    // Actualizar intento
    await this.updateAttempt(intentoId, {
      respuestas: respuestasCalificadas,
      calificacion,
      fechaFin: new Date(),
      estado: 'finalizado'
    });

    // 🆕 ACTUALIZAR PROGRESO DEL ESTUDIANTE
    try {
      // Obtener datos del intento para sacar estudianteId y seccionId
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
   * Comparar respuestas simples
   */
  private compararRespuestas(respuesta: string | string[], correcta: string | string[]): boolean {
    if (typeof respuesta === 'string' && typeof correcta === 'string') {
      return respuesta.toLowerCase().trim() === correcta.toLowerCase().trim();
    }
    return false;
  }

  /**
   * Comparar respuestas múltiples
   */
  private compararRespuestasMultiples(respuestas: string[], correctas: string[]): boolean {
    if (respuestas.length !== correctas.length) return false;

    const respuestasOrdenadas = [...respuestas].sort();
    const correctasOrdenadas = [...correctas].sort();

    return respuestasOrdenadas.every((r, i) => r === correctasOrdenadas[i]);
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
   */
  generateQuestionId(): string {
    return `pregunta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
