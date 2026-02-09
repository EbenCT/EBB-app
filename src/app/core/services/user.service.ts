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
  documentId
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { UserModel, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersCollection = collection(this.firestore, 'users');

  constructor(private firestore: Firestore) {}

  /**
   * Obtener todos los usuarios
   */
  getAllUsers(): Observable<UserModel[]> {
    return collectionData(this.usersCollection, { idField: 'id' }) as Observable<UserModel[]>;
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(userId: string): Promise<UserModel | null> {
    try {
      const userDocRef = doc(this.firestore, `users/${userId}`);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as UserModel;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      throw error;
    }
  }

  /**
   * ✅ OPTIMIZACIÓN: Obtener múltiples usuarios por IDs (batch loading)
   * Reduce N llamadas a 1 llamada usando 'in' operator
   */
  async getUsersByIds(userIds: string[]): Promise<Map<string, UserModel>> {
    const usersMap = new Map<string, UserModel>();

    if (userIds.length === 0) return usersMap;

    // Filtrar IDs únicos y no nulos
    const uniqueIds = [...new Set(userIds.filter(id => id))];
    if (uniqueIds.length === 0) return usersMap;

    try {
      // Firestore 'in' limita a 10 items, dividir en chunks
      const chunks = [];
      for (let i = 0; i < uniqueIds.length; i += 10) {
        chunks.push(uniqueIds.slice(i, i + 10));
      }

      // Ejecutar queries en paralelo
      const queryPromises = chunks.map(chunk =>
        getDocs(query(
          this.usersCollection,
          where(documentId(), 'in', chunk)
        ))
      );

      const snapshots = await Promise.all(queryPromises);

      // Procesar resultados
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          usersMap.set(doc.id, {
            id: doc.id,
            ...doc.data()
          } as UserModel);
        });
      });

      return usersMap;
    } catch (error) {
      console.error('Error en batch loading de usuarios:', error);
      throw error;
    }
  }

  /**
   * Obtener usuarios por rol
   */
  async getUsersByRole(role: UserRole): Promise<UserModel[]> {
    try {
      const q = query(this.usersCollection, where('rol', '==', role));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserModel));
    } catch (error) {
      console.error('Error obteniendo usuarios por rol:', error);
      throw error;
    }
  }

  /**
   * Actualizar usuario
   */
  async updateUser(userId: string, data: Partial<UserModel>): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, `users/${userId}`);
      await updateDoc(userDocRef, data as any);
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  /**
   * Cambiar rol de usuario
   */
  async changeUserRole(userId: string, newRole: UserRole): Promise<void> {
    try {
      await this.updateUser(userId, { rol: newRole });
    } catch (error) {
      console.error('Error cambiando rol:', error);
      throw error;
    }
  }

  /**
   * Activar/Desactivar usuario
   */
  async toggleUserStatus(userId: string, active: boolean): Promise<void> {
    try {
      await this.updateUser(userId, { activo: active });
    } catch (error) {
      console.error('Error cambiando estado:', error);
      throw error;
    }
  }

  /**
   * Eliminar usuario (soft delete)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.updateUser(userId, { activo: false });
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      throw error;
    }
  }

  /**
   * Inscribir estudiante a curso
   */
  async enrollStudentToCourse(studentId: string, courseId: string): Promise<void> {
    try {
      const student = await this.getUserById(studentId);
      if (!student) throw new Error('Estudiante no encontrado');

      const cursosInscritos = student.cursosInscritos || [];
      if (!cursosInscritos.includes(courseId)) {
        cursosInscritos.push(courseId);
        await this.updateUser(studentId, { cursosInscritos });
      }
    } catch (error) {
      console.error('Error inscribiendo estudiante:', error);
      throw error;
    }
  }

  /**
   * Desinscribir estudiante de curso
   */
  async unenrollStudentFromCourse(studentId: string, courseId: string): Promise<void> {
    try {
      const student = await this.getUserById(studentId);
      if (!student) throw new Error('Estudiante no encontrado');

      const cursosInscritos = (student.cursosInscritos || []).filter(id => id !== courseId);
      await this.updateUser(studentId, { cursosInscritos });
    } catch (error) {
      console.error('Error desinscribiendo estudiante:', error);
      throw error;
    }
  }

  /**
   * Asignar profesor a curso
   */
  async assignTeacherToCourse(teacherId: string, courseId: string): Promise<void> {
    try {
      const teacher = await this.getUserById(teacherId);
      if (!teacher) throw new Error('Profesor no encontrado');

      const cursosAsignados = teacher.cursosAsignados || [];
      if (!cursosAsignados.includes(courseId)) {
        cursosAsignados.push(courseId);
        await this.updateUser(teacherId, { cursosAsignados });
      }
    } catch (error) {
      console.error('Error asignando profesor:', error);
      throw error;
    }
  }

  /**
   * Remover profesor de curso
   */
  async removeTeacherFromCourse(teacherId: string, courseId: string): Promise<void> {
    try {
      const teacher = await this.getUserById(teacherId);
      if (!teacher) throw new Error('Profesor no encontrado');

      const cursosAsignados = (teacher.cursosAsignados || []).filter(id => id !== courseId);
      await this.updateUser(teacherId, { cursosAsignados });
    } catch (error) {
      console.error('Error removiendo profesor:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getUserStats() {
    try {
      const allUsers = await getDocs(this.usersCollection);
      const users = allUsers.docs.map(doc => doc.data() as UserModel);

      return {
        total: users.length,
        estudiantes: users.filter(u => u.rol === 'estudiante').length,
        profesores: users.filter(u => u.rol === 'profesor').length,
        admins: users.filter(u => u.rol === 'admin').length,
        activos: users.filter(u => u.activo).length,
        inactivos: users.filter(u => !u.activo).length
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}
