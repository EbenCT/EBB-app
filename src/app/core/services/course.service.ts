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
  arrayUnion,
  arrayRemove
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { Curso } from '../models/course.model';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private coursesCollection = collection(this.firestore, 'cursos');

  constructor(
    private firestore: Firestore,
    private userService: UserService
  ) {}

  /**
   * Obtener todos los cursos
   */
  getAllCourses(): Observable<Curso[]> {
    return collectionData(this.coursesCollection, { idField: 'id' }).pipe(
      map(courses => courses.map(course => ({
        ...course,
        fechaCreacion: course['fechaCreacion'] instanceof Date
          ? course['fechaCreacion']
          : (course['fechaCreacion'] as any).toDate()
      })))
    ) as Observable<Curso[]>;
  }

  /**
   * Obtener curso por ID
   */
  async getCourseById(courseId: string): Promise<Curso | null> {
    try {
      const courseDocRef = doc(this.firestore, `cursos/${courseId}`);
      const courseDoc = await getDoc(courseDocRef);

      if (courseDoc.exists()) {
        const data = courseDoc.data();
        return {
          id: courseDoc.id,
          ...data,
          fechaCreacion: data['fechaCreacion'] instanceof Date
            ? data['fechaCreacion']
            : data['fechaCreacion'].toDate()
        } as Curso;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo curso:', error);
      throw error;
    }
  }

  /**
   * Obtener cursos por profesor
   */
  async getCoursesByProfesor(profesorId: string): Promise<Curso[]> {
    try {
      const q = query(this.coursesCollection, where('profesorId', '==', profesorId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fechaCreacion: data['fechaCreacion'] instanceof Date
            ? data['fechaCreacion']
            : data['fechaCreacion'].toDate()
        } as Curso;
      });
    } catch (error) {
      console.error('Error obteniendo cursos por profesor:', error);
      throw error;
    }
  }

  /**
   * Obtener cursos donde el estudiante está inscrito
   */
  async getCoursesByEstudiante(estudianteId: string): Promise<Curso[]> {
    try {
      const q = query(this.coursesCollection, where('estudiantes', 'array-contains', estudianteId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fechaCreacion: data['fechaCreacion'] instanceof Date
            ? data['fechaCreacion']
            : data['fechaCreacion'].toDate()
        } as Curso;
      });
    } catch (error) {
      console.error('Error obteniendo cursos por estudiante:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo curso
   */
  async createCourse(courseData: Partial<Curso>): Promise<string> {
    try {
      const courseId = doc(this.coursesCollection).id;
      const courseDocRef = doc(this.firestore, `cursos/${courseId}`);

      const newCourse: Curso = {
        id: courseId,
        titulo: courseData.titulo!,
        descripcion: courseData.descripcion!,
        imagen: courseData.imagen || '',
        profesorId: courseData.profesorId || '',
        fechaCreacion: new Date(),
        activo: courseData.activo !== undefined ? courseData.activo : true,
        estudiantes: [],
        secciones: [],
        configuracionCalificaciones: {
          cursoId: courseId,
          elementos: []
        }
      };

      await setDoc(courseDocRef, newCourse);

      // Si se asignó un profesor, actualizar su lista de cursos
      if (courseData.profesorId) {
        await this.userService.updateUser(courseData.profesorId, {
          cursosAsignados: arrayUnion(courseId) as any
        });
      }

      return courseId;
    } catch (error) {
      console.error('Error creando curso:', error);
      throw error;
    }
  }

  /**
   * Actualizar curso
   */
  async updateCourse(courseId: string, data: Partial<Curso>): Promise<void> {
    try {
      const courseDocRef = doc(this.firestore, `cursos/${courseId}`);

      // Si se cambió el profesor, actualizar ambos usuarios
      if (data.profesorId !== undefined) {
        const currentCourse = await this.getCourseById(courseId);

        // Remover de profesor anterior
        if (currentCourse?.profesorId) {
          await this.userService.updateUser(currentCourse.profesorId, {
            cursosAsignados: arrayRemove(courseId) as any
          });
        }

        // Agregar a nuevo profesor
        if (data.profesorId) {
          await this.userService.updateUser(data.profesorId, {
            cursosAsignados: arrayUnion(courseId) as any
          });
        }
      }

      await updateDoc(courseDocRef, data as any);
    } catch (error) {
      console.error('Error actualizando curso:', error);
      throw error;
    }
  }

  /**
   * Eliminar curso
   */
  async deleteCourse(courseId: string): Promise<void> {
    try {
      const course = await this.getCourseById(courseId);

      // Remover de profesor si tiene
      if (course?.profesorId) {
        await this.userService.updateUser(course.profesorId, {
          cursosAsignados: arrayRemove(courseId) as any
        });
      }

      // Remover de todos los estudiantes inscritos
      if (course?.estudiantes && course.estudiantes.length > 0) {
        for (const estudianteId of course.estudiantes) {
          await this.userService.updateUser(estudianteId, {
            cursosInscritos: arrayRemove(courseId) as any
          });
        }
      }

      const courseDocRef = doc(this.firestore, `cursos/${courseId}`);
      await deleteDoc(courseDocRef);
    } catch (error) {
      console.error('Error eliminando curso:', error);
      throw error;
    }
  }

  /**
   * Inscribir estudiante a curso
   */
  async enrollStudent(courseId: string, estudianteId: string): Promise<void> {
    try {
      const courseDocRef = doc(this.firestore, `cursos/${courseId}`);

      await updateDoc(courseDocRef, {
        estudiantes: arrayUnion(estudianteId)
      });

      await this.userService.updateUser(estudianteId, {
        cursosInscritos: arrayUnion(courseId) as any
      });
    } catch (error) {
      console.error('Error inscribiendo estudiante:', error);
      throw error;
    }
  }

  /**
   * Desinscribir estudiante de curso
   */
  async unenrollStudent(courseId: string, estudianteId: string): Promise<void> {
    try {
      const courseDocRef = doc(this.firestore, `cursos/${courseId}`);

      await updateDoc(courseDocRef, {
        estudiantes: arrayRemove(estudianteId)
      });

      await this.userService.updateUser(estudianteId, {
        cursosInscritos: arrayRemove(courseId) as any
      });
    } catch (error) {
      console.error('Error desinscribiendo estudiante:', error);
      throw error;
    }
  }

  /**
   * Cambiar estado del curso (activo/inactivo)
   */
  async toggleCourseStatus(courseId: string, active: boolean): Promise<void> {
    try {
      await this.updateCourse(courseId, { activo: active });
    } catch (error) {
      console.error('Error cambiando estado del curso:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de cursos
   */
  async getCourseStats(): Promise<{
    totalCursos: number;
    cursosActivos: number;
    cursosInactivos: number;
    totalEstudiantes: number;
  }> {
    try {
      const querySnapshot = await getDocs(this.coursesCollection);
      const courses = querySnapshot.docs.map(doc => doc.data());

      let totalEstudiantes = 0;
      courses.forEach(course => {
        totalEstudiantes += course['estudiantes']?.length || 0;
      });

      return {
        totalCursos: courses.length,
        cursosActivos: courses.filter(c => c['activo']).length,
        cursosInactivos: courses.filter(c => !c['activo']).length,
        totalEstudiantes
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}
