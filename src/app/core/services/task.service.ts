import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, collectionData, getDoc, getDocs, documentId } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Tarea, EntregaTarea } from '../models/task.model';
import { LessonService } from './lesson.service';
import { GradeService } from './grade.service';
import { AuthService } from './auth.service';
import { SectionService } from './section.service';
import { ProgressUnlockService } from './progress-unlock.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tareasCollection = collection(this.firestore, 'tareas');
  private entregasCollection = collection(this.firestore, 'entregas');

  constructor(
    private firestore: Firestore,
    private lessonService: LessonService,
    private gradeService: GradeService,
    private authService: AuthService,
    private sectionService: SectionService,
    private progressUnlockService: ProgressUnlockService
  ) {}

  /**
   * Obtener tareas de una lección
   */
  getTasksByLesson(leccionId: string): Observable<Tarea[]> {
    const q = query(
      this.tareasCollection,
      where('leccionId', '==', leccionId),
      orderBy('fechaCreacion', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Tarea[]>;
  }

  /**
   * Obtener tarea por ID
   */
  async getTaskById(tareaId: string): Promise<Tarea | null> {
    try {
      const tareaDocRef = doc(this.firestore, `tareas/${tareaId}`);
      const tareaSnapshot = await getDoc(tareaDocRef);

      if (tareaSnapshot.exists()) {
        return { id: tareaSnapshot.id, ...tareaSnapshot.data() } as Tarea;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo tarea:', error);
      return null;
    }
  }

  /**
   * ✅ OPTIMIZACIÓN: Obtener múltiples tareas por IDs (batch loading)
   * Reduce N llamadas a 1 llamada usando 'in' operator
   */
  async getTasksByIds(taskIds: string[]): Promise<Map<string, Tarea>> {
    const tasksMap = new Map<string, Tarea>();

    if (taskIds.length === 0) return tasksMap;

    try {
      // Firestore 'in' limita a 10 items, dividir en chunks
      const chunks = [];
      for (let i = 0; i < taskIds.length; i += 10) {
        chunks.push(taskIds.slice(i, i + 10));
      }

      // Ejecutar queries en paralelo
      const queryPromises = chunks.map(chunk =>
        getDocs(query(
          this.tareasCollection,
          where(documentId(), 'in', chunk)
        ))
      );

      const snapshots = await Promise.all(queryPromises);

      // Procesar resultados
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          tasksMap.set(doc.id, {
            id: doc.id,
            ...doc.data()
          } as Tarea);
        });
      });

      return tasksMap;
    } catch (error) {
      console.error('Error en batch loading de tareas:', error);
      throw error;
    }
  }

  /**
   * Crear tarea
   */
  async createTask(taskData: Partial<Tarea>): Promise<string> {
    try {
      const tareaId = doc(this.tareasCollection).id;
      const tareaDocRef = doc(this.firestore, `tareas/${tareaId}`);

      const newTask: any = {
        id: tareaId,
        leccionId: taskData.leccionId!,
        titulo: taskData.titulo!,
        descripcion: taskData.descripcion || '',
        instrucciones: taskData.instrucciones || '',
        tipoEntrega: taskData.tipoEntrega!,
        fechaInicio: taskData.fechaInicio!,
        fechaFin: taskData.fechaFin!,
        ponderacion: taskData.ponderacion || 0,
        tamanoMaximo: taskData.tamanoMaximo || 5,
        fechaCreacion: new Date()
      };

      // Solo agregar archivosPermitidos si tiene valor
      if (taskData.archivosPermitidos && taskData.archivosPermitidos.length > 0) {
        newTask.archivosPermitidos = taskData.archivosPermitidos;
      }

      await setDoc(tareaDocRef, newTask);

      // Agregar tarea al array de tareas de la lección
      await this.lessonService.addTaskToLesson(taskData.leccionId!, tareaId);

      return tareaId;
    } catch (error) {
      console.error('Error creando tarea:', error);
      throw error;
    }
  }

  /**
   * Actualizar tarea
   */
  async updateTask(tareaId: string, data: Partial<Tarea>): Promise<void> {
    try {
      const tareaDocRef = doc(this.firestore, `tareas/${tareaId}`);
      await updateDoc(tareaDocRef, data as any);
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      throw error;
    }
  }

  /**
   * Eliminar tarea
   */
  async deleteTask(tareaId: string): Promise<void> {
    try {
      const tarea = await this.getTaskById(tareaId);
      if (!tarea) return;

      // Eliminar todas las entregas asociadas
      const entregas = await this.getSubmissionsByTask(tareaId);
      for (const entrega of entregas) {
        await this.deleteSubmission(entrega.id);
      }

      // Remover de la lección
      await this.lessonService.removeTaskFromLesson(tarea.leccionId, tareaId);

      // Eliminar tarea
      const tareaDocRef = doc(this.firestore, `tareas/${tareaId}`);
      await deleteDoc(tareaDocRef);
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      throw error;
    }
  }

  /**
   * Obtener entregas de una tarea
   */
  async getSubmissionsByTask(tareaId: string): Promise<EntregaTarea[]> {
    try {
      const q = query(
        this.entregasCollection,
        where('tareaId', '==', tareaId)
      );

      return new Promise((resolve, reject) => {
        const subscription = collectionData(q, { idField: 'id' }).subscribe({
          next: (entregas) => {
            subscription.unsubscribe();
            resolve(entregas as EntregaTarea[]);
          },
          error: (error) => {
            subscription.unsubscribe();
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error obteniendo entregas:', error);
      return [];
    }
  }

  /**
   * Obtener entregas de un estudiante en una tarea específica
   */
  async getSubmissionByStudentAndTask(estudianteId: string, tareaId: string): Promise<EntregaTarea | null> {
    try {
      const q = query(
        this.entregasCollection,
        where('tareaId', '==', tareaId),
        where('estudianteId', '==', estudianteId)
      );

      return new Promise((resolve, reject) => {
        const subscription = collectionData(q, { idField: 'id' }).subscribe({
          next: (entregas) => {
            subscription.unsubscribe();
            resolve(entregas.length > 0 ? entregas[0] as EntregaTarea : null);
          },
          error: (error) => {
            subscription.unsubscribe();
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error obteniendo entrega:', error);
      return null;
    }
  }

  /**
   * Crear o actualizar entrega
   */
  async submitTask(entregaData: Partial<EntregaTarea>): Promise<string> {
    try {
      // Verificar si ya existe una entrega
      const existingSubmission = await this.getSubmissionByStudentAndTask(
        entregaData.estudianteId!,
        entregaData.tareaId!
      );

      let entregaId: string;

      if (existingSubmission) {
        // Actualizar entrega existente
        const entregaDocRef = doc(this.firestore, `entregas/${existingSubmission.id}`);
        await updateDoc(entregaDocRef, {
          contenidoTexto: entregaData.contenidoTexto,
          archivos: entregaData.archivos,
          fechaEntrega: new Date(),
          estado: 'entregada'
        });
        entregaId = existingSubmission.id;
      } else {
        // Crear nueva entrega
        entregaId = doc(this.entregasCollection).id;
        const entregaDocRef = doc(this.firestore, `entregas/${entregaId}`);

        const newSubmission: any = {
          id: entregaId,
          tareaId: entregaData.tareaId!,
          estudianteId: entregaData.estudianteId!,
          fechaEntrega: new Date(),
          estado: 'entregada'
        };

        if (entregaData.contenidoTexto) {
          newSubmission.contenidoTexto = entregaData.contenidoTexto;
        }
        if (entregaData.archivos && entregaData.archivos.length > 0) {
          newSubmission.archivos = entregaData.archivos;
        }

        await setDoc(entregaDocRef, newSubmission);
      }

      // 🆕 ACTUALIZAR PROGRESO DEL ESTUDIANTE
      try {
        const tarea = await this.getTaskById(entregaData.tareaId!);
        if (tarea) {
          const leccion = await this.lessonService.getLessonById(tarea.leccionId);
          if (leccion && leccion.seccionId) {
            await this.progressUnlockService.actualizarProgresoEstudiante(
              leccion.seccionId,
              entregaData.estudianteId!
            );
            console.log('✅ Progreso actualizado tras entregar tarea');
          }
        }
      } catch (progressError) {
        console.warn('⚠️ Error actualizando progreso (no crítico):', progressError);
      }

      return entregaId;
    } catch (error) {
      console.error('Error enviando tarea:', error);
      throw error;
    }
  }

  /**
   * Calificar entrega
   */
  async gradeSubmission(entregaId: string, calificacion: number, retroalimentacion?: string): Promise<void> {
    try {
      // Actualizar la entrega
      const entregaDocRef = doc(this.firestore, `entregas/${entregaId}`);
      await updateDoc(entregaDocRef, {
        calificacion,
        retroalimentacion: retroalimentacion || '',
        estado: 'calificada'
      });

      // Obtener datos de la entrega y la tarea para crear/actualizar la calificación
      const entregaSnap = await getDoc(entregaDocRef);
      if (entregaSnap.exists()) {
        const entregaData = entregaSnap.data() as EntregaTarea;
        const tarea = await this.getTaskById(entregaData.tareaId);

        if (tarea) {
          // Obtener la lección para obtener el seccionId
          const leccion = await this.lessonService.getLessonById(tarea.leccionId);

          if (leccion) {
            // Obtener la sección para obtener el cursoId
            const seccion = await this.sectionService.getSectionById(leccion.seccionId);

            if (seccion) {
              const currentUser = this.authService.getCurrentUser();
              const puntosFinal = (calificacion * tarea.ponderacion) / 100;

              // Verificar si ya existe una calificación para esta tarea y estudiante
              const calificacionExistente = await this.gradeService.getGradeByStudentAndTask(
                entregaData.estudianteId,
                tarea.id
              );

              if (calificacionExistente) {
                // Actualizar calificación existente
                await this.gradeService.updateGrade(calificacionExistente.id, {
                  calificacion,
                  puntosFinal,
                  fechaCalificacion: new Date(),
                  retroalimentacion: retroalimentacion || '',
                  profesorId: currentUser?.uid || ''
                });
              } else {
                // Crear nueva calificación
                await this.gradeService.createGrade({
                  estudianteId: entregaData.estudianteId,
                  cursoId: seccion.cursoId,
                  tareaId: tarea.id,
                  tipo: 'tarea',
                  calificacion,
                  ponderacion: tarea.ponderacion,
                  puntosFinal,
                  fechaCalificacion: new Date(),
                  retroalimentacion: retroalimentacion || '',
                  profesorId: currentUser?.uid || ''
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error calificando entrega:', error);
      throw error;
    }
  }

  /**
   * Eliminar entrega
   */
  async deleteSubmission(entregaId: string): Promise<void> {
    try {
      const entregaDocRef = doc(this.firestore, `entregas/${entregaId}`);
      await deleteDoc(entregaDocRef);
    } catch (error) {
      console.error('Error eliminando entrega:', error);
      throw error;
    }
  }

  /**
   * Obtener tareas de un estudiante por curso
   */
  async getTasksByStudentAndCourse(estudianteId: string, cursoId: string): Promise<any[]> {
    // Esta función requiere consultar secciones del curso y luego tareas
    // Se implementará cuando se necesite en el dashboard del estudiante
    return [];
  }

  /**
   * Verificar si una tarea está retrasada
   */
  isTaskOverdue(tarea: Tarea): boolean {
    const now = new Date();
    const fechaFin = tarea.fechaFin instanceof Date ? tarea.fechaFin : (tarea.fechaFin as any).toDate();
    return now > fechaFin;
  }

  /**
   * Verificar si una tarea está disponible
   */
  isTaskAvailable(tarea: Tarea): boolean {
    const now = new Date();
    const fechaInicio = tarea.fechaInicio instanceof Date ? tarea.fechaInicio : (tarea.fechaInicio as any).toDate();
    const fechaFin = tarea.fechaFin instanceof Date ? tarea.fechaFin : (tarea.fechaFin as any).toDate();
    return now >= fechaInicio && now <= fechaFin;
  }
}
