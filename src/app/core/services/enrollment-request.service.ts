import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { collectionData } from '@angular/fire/firestore';
import { SolicitudInscripcion } from '../models/enrollment-request.model';
import { UserService } from './user.service';
import { CourseService } from './course.service';

@Injectable({
  providedIn: 'root'
})
export class EnrollmentRequestService {
  private firestore = inject(Firestore);
  private userService = inject(UserService);
  private courseService = inject(CourseService);
  private solicitudesCollection = collection(this.firestore, 'solicitudes-inscripcion');

  /**
   * Crear solicitud de inscripción
   */
  async createRequest(
    estudianteId: string,
    estudianteNombre: string,
    estudianteEmail: string,
    cursoId: string,
    cursoNombre: string
  ): Promise<string> {
    try {
      const solicitudId = doc(this.solicitudesCollection).id;
      const solicitudDocRef = doc(this.firestore, `solicitudes-inscripcion/${solicitudId}`);

      const solicitud: SolicitudInscripcion = {
        id: solicitudId,
        estudianteId,
        estudianteNombre,
        estudianteEmail,
        cursoId,
        cursoNombre,
        fechaSolicitud: new Date(),
        estado: 'pendiente'
      };

      await setDoc(solicitudDocRef, solicitud);
      return solicitudId;
    } catch (error) {
      console.error('Error creando solicitud:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las solicitudes (con filtro opcional por estado)
   */
  getSolicitudes(estado?: 'pendiente' | 'aceptada' | 'rechazada'): Observable<SolicitudInscripcion[]> {
    try {
      let q;
      if (estado) {
        q = query(
          this.solicitudesCollection,
          where('estado', '==', estado),
          orderBy('fechaSolicitud', 'desc')
        );
      } else {
        q = query(this.solicitudesCollection, orderBy('fechaSolicitud', 'desc'));
      }

      return collectionData(q, { idField: 'id' }) as Observable<SolicitudInscripcion[]>;
    } catch (error) {
      console.error('Error obteniendo solicitudes:', error);
      throw error;
    }
  }

  /**
   * Obtener solicitudes de un estudiante específico
   */
  getMySolicitudes(estudianteId: string): Observable<SolicitudInscripcion[]> {
    try {
      const q = query(
        this.solicitudesCollection,
        where('estudianteId', '==', estudianteId),
        orderBy('fechaSolicitud', 'desc')
      );

      return collectionData(q, { idField: 'id' }) as Observable<SolicitudInscripcion[]>;
    } catch (error) {
      console.error('Error obteniendo solicitudes del estudiante:', error);
      throw error;
    }
  }

  /**
   * Verificar si el estudiante ya tiene una solicitud pendiente para un curso
   */
  async hasPendingRequest(estudianteId: string, cursoId: string): Promise<boolean> {
    try {
      const q = query(
        this.solicitudesCollection,
        where('estudianteId', '==', estudianteId),
        where('cursoId', '==', cursoId),
        where('estado', '==', 'pendiente')
      );

      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error verificando solicitud pendiente:', error);
      return false;
    }
  }

  /**
   * Aceptar solicitud de inscripción
   */
  async acceptRequest(solicitudId: string, adminId: string): Promise<void> {
    try {
      const solicitudDocRef = doc(this.firestore, `solicitudes-inscripcion/${solicitudId}`);
      const solicitudDoc = await getDoc(solicitudDocRef);

      if (!solicitudDoc.exists()) {
        throw new Error('Solicitud no encontrada');
      }

      const solicitud = solicitudDoc.data() as SolicitudInscripcion;

      // 1. Actualizar estado de la solicitud
      await updateDoc(solicitudDocRef, {
        estado: 'aceptada',
        fechaRespuesta: new Date(),
        respondidoPor: adminId
      });

      // 2. Inscribir al estudiante en el curso usando el método existente
      // Este método actualiza AMBAS relaciones: curso.estudiantes[] Y user.cursosInscritos[]
      await this.courseService.enrollStudent(solicitud.cursoId, solicitud.estudianteId);

      console.log('✅ Solicitud aceptada y estudiante inscrito');
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      throw error;
    }
  }

  /**
   * Rechazar solicitud de inscripción
   */
  async rejectRequest(
    solicitudId: string,
    adminId: string,
    motivoRechazo: string
  ): Promise<void> {
    try {
      const solicitudDocRef = doc(this.firestore, `solicitudes-inscripcion/${solicitudId}`);

      await updateDoc(solicitudDocRef, {
        estado: 'rechazada',
        motivoRechazo,
        fechaRespuesta: new Date(),
        respondidoPor: adminId
      });

      console.log('❌ Solicitud rechazada');
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      throw error;
    }
  }
}
