import { Injectable, Injector } from '@angular/core';
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
  orderBy
} from '@angular/fire/firestore';
import { Observable, map, firstValueFrom } from 'rxjs';
import { Seccion, ElementoSeccion } from '../models/section.model';
import { CourseService } from './course.service';

// ============================================================================
// Tipos para la importación desde JSON (generado por la skill word-to-curso-json)
// ============================================================================
export interface ImportLeccionJson {
  titulo: string;
  tipo: 'texto' | 'imagen' | 'pdf' | 'video';
  contenido: string;
}

export interface ImportSeccionJson {
  titulo: string;
  descripcion?: string;
  lecciones: ImportLeccionJson[];
}

export interface ImportCursoJson {
  version: string;
  secciones: ImportSeccionJson[];
}

export interface ImportValidationResult {
  valido: boolean;
  errores: string[];
  data?: ImportCursoJson;
  resumen?: { totalSecciones: number; totalLecciones: number };
}

export interface ImportProgress {
  seccionActual: number;
  totalSecciones: number;
  tituloSeccion: string;
}

@Injectable({
  providedIn: 'root'
})
export class SectionService {
  private sectionsCollection = collection(this.firestore, 'secciones');

  constructor(
    private firestore: Firestore,
    private courseService: CourseService,
    private injector: Injector
  ) {}

  /**
   * Obtener todas las secciones de un curso
   */
  getSectionsByCourse(cursoId: string): Observable<Seccion[]> {
    const q = query(
      this.sectionsCollection,
      where('cursoId', '==', cursoId),
      orderBy('orden', 'asc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Seccion[]>;
  }

  /**
   * Obtener sección por ID
   */
  async getSectionById(sectionId: string): Promise<Seccion | null> {
    try {
      const sectionDocRef = doc(this.firestore, `secciones/${sectionId}`);
      const sectionDoc = await getDoc(sectionDocRef);

      if (sectionDoc.exists()) {
        return { id: sectionDoc.id, ...sectionDoc.data() } as Seccion;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo sección:', error);
      throw error;
    }
  }

  /**
   * Crear nueva sección
   */
  async createSection(sectionData: Partial<Seccion>): Promise<string> {
    try {
      const sectionId = doc(this.sectionsCollection).id;
      const sectionDocRef = doc(this.firestore, `secciones/${sectionId}`);

      const newSection: Seccion = {
        id: sectionId,
        cursoId: sectionData.cursoId!,
        titulo: sectionData.titulo!,
        descripcion: sectionData.descripcion || '',
        orden: sectionData.orden || 0,
        desbloqueoProgresivo: sectionData.desbloqueoProgresivo || false,
        prerequisitos: sectionData.prerequisitos || [],
        requiereCompletarTodo: sectionData.requiereCompletarTodo || false,
        porcentajeMinimo: sectionData.porcentajeMinimo || 70,
        elementos: []
      };

      await setDoc(sectionDocRef, newSection);

      // Actualizar array de secciones en el curso
      const curso = await this.courseService.getCourseById(sectionData.cursoId!);
      if (curso) {
        const secciones = [...curso.secciones, sectionId];
        await this.courseService.updateCourse(sectionData.cursoId!, { secciones });
      }

      return sectionId;
    } catch (error) {
      console.error('Error creando sección:', error);
      throw error;
    }
  }

  /**
   * Actualizar sección
   */
  async updateSection(sectionId: string, data: Partial<Seccion>): Promise<void> {
    try {
      const sectionDocRef = doc(this.firestore, `secciones/${sectionId}`);
      await updateDoc(sectionDocRef, data as any);
    } catch (error) {
      console.error('Error actualizando sección:', error);
      throw error;
    }
  }

  /**
   * Eliminar sección
   */
  async deleteSection(sectionId: string): Promise<void> {
    try {
      const section = await this.getSectionById(sectionId);
      if (!section) return;

      // Eliminar referencia del curso
      const curso = await this.courseService.getCourseById(section.cursoId);
      if (curso) {
        const secciones = curso.secciones.filter(id => id !== sectionId);
        await this.courseService.updateCourse(section.cursoId, { secciones });
      }

      const sectionDocRef = doc(this.firestore, `secciones/${sectionId}`);
      await deleteDoc(sectionDocRef);
    } catch (error) {
      console.error('Error eliminando sección:', error);
      throw error;
    }
  }

  /**
   * Reordenar secciones
   */
  async reorderSections(sections: { id: string; orden: number }[]): Promise<void> {
    try {
      const batch = sections.map(section =>
        this.updateSection(section.id, { orden: section.orden })
      );
      await Promise.all(batch);
    } catch (error) {
      console.error('Error reordenando secciones:', error);
      throw error;
    }
  }

  /**
   * Agregar elemento a sección (leccion, tarea, examen)
   */
  async addElementToSection(
    sectionId: string,
    elementId: string,
    tipo: 'leccion' | 'examen'
  ): Promise<void> {
    try {
      const section = await this.getSectionById(sectionId);
      if (!section) throw new Error('Sección no encontrada');

      const elementos: ElementoSeccion[] = [
        ...section.elementos,
        {
          id: elementId,
          tipo,
          orden: section.elementos.length
        }
      ];

      await this.updateSection(sectionId, { elementos });
    } catch (error) {
      console.error('Error agregando elemento:', error);
      throw error;
    }
  }

  /**
   * Remover elemento de sección
   */
  async removeElementFromSection(sectionId: string, elementId: string): Promise<void> {
    try {
      const section = await this.getSectionById(sectionId);
      if (!section) throw new Error('Sección no encontrada');

      const elementos = section.elementos.filter(el => el.id !== elementId);
      await this.updateSection(sectionId, { elementos });
    } catch (error) {
      console.error('Error removiendo elemento:', error);
      throw error;
    }
  }

  // ==========================================================================
  // IMPORTACIÓN DESDE JSON
  // ==========================================================================

  /**
   * Valida una cadena JSON contra el esquema de importación.
   * No toca Firestore: solo parsea y verifica la estructura.
   */
  validateImportJson(jsonString: string): ImportValidationResult {
    const errores: string[] = [];

    // 1. Parseo
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e: any) {
      return { valido: false, errores: [`JSON inválido: ${e.message}`] };
    }

    // 2. Raíz
    if (typeof parsed !== 'object' || parsed === null) {
      return { valido: false, errores: ['El JSON debe ser un objeto.'] };
    }
    if (!Array.isArray(parsed.secciones)) {
      return { valido: false, errores: ['Falta el array "secciones" en la raíz.'] };
    }
    if (parsed.secciones.length === 0) {
      return { valido: false, errores: ['El array "secciones" está vacío.'] };
    }

    // 3. Secciones y lecciones
    const tiposValidos = ['texto', 'imagen', 'pdf', 'video'];
    let totalLecciones = 0;

    parsed.secciones.forEach((sec: any, i: number) => {
      const etiqueta = `Sección ${i + 1}`;
      if (!sec || typeof sec !== 'object') {
        errores.push(`${etiqueta}: no es un objeto válido.`);
        return;
      }
      if (typeof sec.titulo !== 'string' || sec.titulo.trim() === '') {
        errores.push(`${etiqueta}: falta "titulo" o está vacío.`);
      }
      if (sec.descripcion !== undefined && typeof sec.descripcion !== 'string') {
        errores.push(`${etiqueta}: "descripcion" debe ser texto.`);
      }
      if (!Array.isArray(sec.lecciones)) {
        errores.push(`${etiqueta}: falta el array "lecciones".`);
        return;
      }
      sec.lecciones.forEach((lec: any, j: number) => {
        const etL = `${etiqueta}, Lección ${j + 1}`;
        if (!lec || typeof lec !== 'object') {
          errores.push(`${etL}: no es un objeto válido.`);
          return;
        }
        if (typeof lec.titulo !== 'string' || lec.titulo.trim() === '') {
          errores.push(`${etL}: falta "titulo" o está vacío.`);
        }
        if (typeof lec.contenido !== 'string') {
          errores.push(`${etL}: falta "contenido".`);
        }
        if (lec.tipo !== undefined && !tiposValidos.includes(lec.tipo)) {
          errores.push(`${etL}: "tipo" inválido (${lec.tipo}).`);
        }
        totalLecciones++;
      });
    });

    if (errores.length > 0) {
      return { valido: false, errores };
    }

    return {
      valido: true,
      errores: [],
      data: parsed as ImportCursoJson,
      resumen: {
        totalSecciones: parsed.secciones.length,
        totalLecciones
      }
    };
  }

  /**
   * Importa secciones y lecciones desde un JSON validado.
   * - Continúa el orden a partir de las secciones existentes del curso.
   * - Reutiliza createSection y createLesson (mantiene la doble escritura
   *   sección<->elementos y el array secciones[] del curso).
   */
  async importFromJson(
    cursoId: string,
    data: ImportCursoJson,
    onProgress?: (p: ImportProgress) => void
  ): Promise<{ seccionesCreadas: number; leccionesCreadas: number }> {
    // Resolver LessonService de forma diferida para evitar dependencia circular
    // (LessonService inyecta SectionService).
    const { LessonService } = await import('./lesson.service');
    const lessonService = this.injector.get(LessonService);

    // Punto de partida del orden: cuántas secciones ya tiene el curso.
    const seccionesExistentes = await firstValueFrom(
      this.getSectionsByCourse(cursoId)
    );
    let ordenSeccion = seccionesExistentes.length;

    let seccionesCreadas = 0;
    let leccionesCreadas = 0;

    // Secuencial, NO en paralelo: createSection lee y reescribe el array
    // secciones[] del curso en cada llamada; en paralelo habría condiciones
    // de carrera que pierden referencias.
    for (let i = 0; i < data.secciones.length; i++) {
      const sec = data.secciones[i];

      if (onProgress) {
        onProgress({
          seccionActual: i + 1,
          totalSecciones: data.secciones.length,
          tituloSeccion: sec.titulo
        });
      }

      const seccionId = await this.createSection({
        cursoId,
        titulo: sec.titulo,
        descripcion: sec.descripcion || '',
        orden: ordenSeccion,
        desbloqueoProgresivo: false,
        prerequisitos: [],
        requiereCompletarTodo: false,
        porcentajeMinimo: 70
      });
      seccionesCreadas++;
      ordenSeccion++;

      for (let j = 0; j < sec.lecciones.length; j++) {
        const lec = sec.lecciones[j];
        await lessonService.createLesson({
          seccionId,
          titulo: lec.titulo,
          tipo: lec.tipo || 'texto',
          contenido: lec.contenido,
          orden: j
        });
        leccionesCreadas++;
      }
    }

    return { seccionesCreadas, leccionesCreadas };
  }
}
