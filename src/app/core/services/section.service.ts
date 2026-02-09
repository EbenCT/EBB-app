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
  orderBy
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Seccion, ElementoSeccion } from '../models/section.model';
import { CourseService } from './course.service';

@Injectable({
  providedIn: 'root'
})
export class SectionService {
  private sectionsCollection = collection(this.firestore, 'secciones');

  constructor(
    private firestore: Firestore,
    private courseService: CourseService
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
}
