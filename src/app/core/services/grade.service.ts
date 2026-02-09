import { Injectable } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, Timestamp } from '@angular/fire/firestore';
import { Calificacion } from '../models/grade.model';

@Injectable({
  providedIn: 'root'
})
export class GradeService {
  private collectionName = 'calificaciones';

  constructor(private firestore: Firestore) {}

  async createGrade(calificacion: Omit<Calificacion, 'id'>): Promise<string> {
    const calificacionesRef = collection(this.firestore, this.collectionName);
    const docData = {
      ...calificacion,
      fechaCalificacion: Timestamp.fromDate(calificacion.fechaCalificacion)
    };
    const docRef = await addDoc(calificacionesRef, docData);
    return docRef.id;
  }

  async getGradeById(id: string): Promise<Calificacion | null> {
    const docRef = doc(this.firestore, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        fechaCalificacion: data['fechaCalificacion']?.toDate()
      } as Calificacion;
    }
    return null;
  }

  async getGradesByStudent(estudianteId: string, cursoId: string): Promise<Calificacion[]> {
    const calificacionesRef = collection(this.firestore, this.collectionName);
    const q = query(
      calificacionesRef,
      where('estudianteId', '==', estudianteId),
      where('cursoId', '==', cursoId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaCalificacion: data['fechaCalificacion']?.toDate()
      } as Calificacion;
    });
  }

  async getGradesByTask(tareaId: string): Promise<Calificacion[]> {
    const calificacionesRef = collection(this.firestore, this.collectionName);
    const q = query(calificacionesRef, where('tareaId', '==', tareaId));

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaCalificacion: data['fechaCalificacion']?.toDate()
      } as Calificacion;
    });
  }

  async getGradeByStudentAndTask(estudianteId: string, tareaId: string): Promise<Calificacion | null> {
    const calificacionesRef = collection(this.firestore, this.collectionName);
    const q = query(
      calificacionesRef,
      where('estudianteId', '==', estudianteId),
      where('tareaId', '==', tareaId),
      where('tipo', '==', 'tarea')
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaCalificacion: data['fechaCalificacion']?.toDate()
      } as Calificacion;
    }
    return null;
  }

  async updateGrade(id: string, calificacion: Partial<Calificacion>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    const updateData: any = { ...calificacion };

    if (calificacion.fechaCalificacion) {
      updateData.fechaCalificacion = Timestamp.fromDate(calificacion.fechaCalificacion);
    }

    await updateDoc(docRef, updateData);
  }

  async deleteGrade(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }

  async calculateStudentAverage(estudianteId: string, cursoId: string): Promise<number> {
    const calificaciones = await this.getGradesByStudent(estudianteId, cursoId);

    if (calificaciones.length === 0) return 0;

    const totalPuntos = calificaciones.reduce((acc, cal) => acc + cal.puntosFinal, 0);
    const totalPonderacion = calificaciones.reduce((acc, cal) => acc + cal.ponderacion, 0);

    if (totalPonderacion === 0) return 0;

    // Retornar el porcentaje real basado en la ponderación
    return (totalPuntos / totalPonderacion) * 100;
  }
}
