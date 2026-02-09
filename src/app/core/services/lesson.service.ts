import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  documentId
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Leccion } from '../models/lesson.model';
import { SectionService } from './section.service';

@Injectable({
  providedIn: 'root'
})
export class LessonService {
  private lessonsCollection = collection(this.firestore, 'lecciones');

  constructor(
    private firestore: Firestore,
    private sectionService: SectionService
  ) {}

  /**
   * Obtener todas las lecciones de una sección
   */
  getLessonsBySection(seccionId: string): Observable<Leccion[]> {
    const q = query(
      this.lessonsCollection,
      where('seccionId', '==', seccionId),
      orderBy('orden', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Leccion[]>;
  }

  /**
   * Obtener lección por ID
   */
  async getLessonById(lessonId: string): Promise<Leccion | null> {
    try {
      const lessonDocRef = doc(this.firestore, `lecciones/${lessonId}`);
      const lessonDoc = await getDoc(lessonDocRef);

      if (lessonDoc.exists()) {
        const data = lessonDoc.data();
        return {
          id: lessonDoc.id,
          ...data,
          fechaCreacion: data['fechaCreacion'] instanceof Date
            ? data['fechaCreacion']
            : data['fechaCreacion'].toDate()
        } as Leccion;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo lección:', error);
      throw error;
    }
  }

  /**
   * Crear nueva lección
   */
  async createLesson(lessonData: Partial<Leccion>): Promise<string> {
    try {
      const lessonId = doc(this.lessonsCollection).id;
      const lessonDocRef = doc(this.firestore, `lecciones/${lessonId}`);

      const newLesson: any = {
        id: lessonId,
        seccionId: lessonData.seccionId!,
        titulo: lessonData.titulo!,
        tipo: lessonData.tipo!,
        contenido: lessonData.contenido || '',
        orden: lessonData.orden || 0,
        tareas: [], // Inicializar array vacío de tareas
        fechaCreacion: new Date()
      };

      // Solo agregar campos opcionales si tienen valor
      if (lessonData.urlArchivo) {
        newLesson.urlArchivo = lessonData.urlArchivo;
      }
      if (lessonData.urlYoutube) {
        newLesson.urlYoutube = lessonData.urlYoutube;
      }

      await setDoc(lessonDocRef, newLesson);

      // Agregar lección al array de elementos de la sección
      await this.sectionService.addElementToSection(
        lessonData.seccionId!,
        lessonId,
        'leccion'
      );

      return lessonId;
    } catch (error) {
      console.error('Error creando lección:', error);
      throw error;
    }
  }

  /**
   * Actualizar lección
   */
  async updateLesson(lessonId: string, data: Partial<Leccion>): Promise<void> {
    try {
      const lessonDocRef = doc(this.firestore, `lecciones/${lessonId}`);
      await updateDoc(lessonDocRef, data as any);
    } catch (error) {
      console.error('Error actualizando lección:', error);
      throw error;
    }
  }

  /**
   * Eliminar lección
   */
  async deleteLesson(lessonId: string): Promise<void> {
    try {
      const lesson = await this.getLessonById(lessonId);
      if (!lesson) return;

      // TODO: Eliminar todas las tareas asociadas
      // if (lesson.tareas && lesson.tareas.length > 0) {
      //   await Promise.all(lesson.tareas.map(tareaId =>
      //     this.taskService.deleteTask(tareaId)
      //   ));
      // }

      // Eliminar referencia de la sección
      await this.sectionService.removeElementFromSection(lesson.seccionId, lessonId);

      const lessonDocRef = doc(this.firestore, `lecciones/${lessonId}`);
      await deleteDoc(lessonDocRef);
    } catch (error) {
      console.error('Error eliminando lección:', error);
      throw error;
    }
  }

  /**
   * Agregar tarea al array de tareas de una lección
   */
  async addTaskToLesson(lessonId: string, tareaId: string): Promise<void> {
    try {
      const lesson = await this.getLessonById(lessonId);
      if (!lesson) throw new Error('Lección no encontrada');

      const tareas = lesson.tareas || [];
      if (!tareas.includes(tareaId)) {
        tareas.push(tareaId);
        await this.updateLesson(lessonId, { tareas });
      }
    } catch (error) {
      console.error('Error agregando tarea a lección:', error);
      throw error;
    }
  }

  /**
   * Remover tarea del array de tareas de una lección
   */
  async removeTaskFromLesson(lessonId: string, tareaId: string): Promise<void> {
    try {
      const lesson = await this.getLessonById(lessonId);
      if (!lesson) return;

      const tareas = (lesson.tareas || []).filter(id => id !== tareaId);
      await this.updateLesson(lessonId, { tareas });
    } catch (error) {
      console.error('Error removiendo tarea de lección:', error);
      throw error;
    }
  }

  /**
   * Reordenar lecciones
   */
  async reorderLessons(lessons: { id: string; orden: number }[]): Promise<void> {
    try {
      const batch = lessons.map(lesson =>
        this.updateLesson(lesson.id, { orden: lesson.orden })
      );
      await Promise.all(batch);
    } catch (error) {
      console.error('Error reordenando lecciones:', error);
      throw error;
    }
  }

  /**
   * ✅ OPTIMIZACIÓN: Obtener múltiples lecciones por IDs (batch loading)
   * Reduce N llamadas a 1 llamada usando 'in' operator
   */
  async getLessonsByIds(lessonIds: string[]): Promise<Map<string, Leccion>> {
    const lessonsMap = new Map<string, Leccion>();

    if (lessonIds.length === 0) return lessonsMap;

    try {
      // Firestore 'in' limita a 10 items, dividir en chunks
      const chunks = [];
      for (let i = 0; i < lessonIds.length; i += 10) {
        chunks.push(lessonIds.slice(i, i + 10));
      }

      // Ejecutar queries en paralelo
      const queryPromises = chunks.map(chunk =>
        getDocs(query(
          this.lessonsCollection,
          where(documentId(), 'in', chunk)
        ))
      );

      const snapshots = await Promise.all(queryPromises);

      // Procesar resultados
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          lessonsMap.set(doc.id, {
            id: doc.id,
            ...data,
            fechaCreacion: data['fechaCreacion'] instanceof Date
              ? data['fechaCreacion']
              : data['fechaCreacion'].toDate()
          } as Leccion);
        });
      });

      return lessonsMap;
    } catch (error) {
      console.error('Error en batch loading de lecciones:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de lecciones por curso
   */
  async getLessonStatsByCourse(cursoId: string): Promise<{
    total: number;
    porTipo: { [key: string]: number };
  }> {
    try {
      // Obtener todas las secciones del curso
      const sectionsQuery = query(
        collection(this.firestore, 'secciones'),
        where('cursoId', '==', cursoId)
      );
      const sectionsSnapshot = await getDocs(sectionsQuery);
      const sectionIds = sectionsSnapshot.docs.map(doc => doc.id);

      if (sectionIds.length === 0) {
        return { total: 0, porTipo: {} };
      }

      // Obtener todas las lecciones de esas secciones
      const lessonsQuery = query(
        this.lessonsCollection,
        where('seccionId', 'in', sectionIds.slice(0, 10)) // Firestore limita a 10 items en 'in'
      );
      const lessonsSnapshot = await getDocs(lessonsQuery);
      const lessons = lessonsSnapshot.docs.map(doc => doc.data() as Leccion);

      const porTipo: { [key: string]: number } = {};
      lessons.forEach(lesson => {
        porTipo[lesson.tipo] = (porTipo[lesson.tipo] || 0) + 1;
      });

      return {
        total: lessons.length,
        porTipo
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}
