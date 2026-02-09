import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, Timestamp, writeBatch } from '@angular/fire/firestore';
import { Asistencia, EstadoAsistencia, estadoAPuntaje, normalizarFecha, RegistroAsistenciaEstudiante } from '../models/asistencia.model';

@Injectable({
  providedIn: 'root'
})
export class AsistenciaService {

  constructor(private firestore: Firestore) { }

  /**
   * Registrar asistencias de múltiples estudiantes (operación masiva)
   */
  async registrarAsistenciasMasivas(
    cursoId: string,
    registros: RegistroAsistenciaEstudiante[],
    fecha: Date,
    registradoPor: string
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    const fechaNormalizada = normalizarFecha(fecha);
    const fechaRegistro = new Date();

    for (const registro of registros) {
      // Si no hay estado marcado, asignar 'F' (Falta)
      const estado = registro.estado || 'F';
      const puntaje = estadoAPuntaje(estado);

      // Crear ID único: cursoId_estudianteId_fecha
      const fechaStr = fechaNormalizada.toISOString().split('T')[0]; // YYYY-MM-DD
      const asistenciaId = `${cursoId}_${registro.estudianteId}_${fechaStr}`;

      const asistenciaData: Asistencia = {
        cursoId,
        estudianteId: registro.estudianteId,
        fecha: fechaNormalizada,
        estado,
        puntaje,
        registradoPor,
        fechaRegistro
      };

      const asistenciaRef = doc(this.firestore, 'asistencias', asistenciaId);
      batch.set(asistenciaRef, {
        ...asistenciaData,
        fecha: Timestamp.fromDate(fechaNormalizada),
        fechaRegistro: Timestamp.fromDate(fechaRegistro)
      }, { merge: true }); // merge: true para actualizar si ya existe
    }

    await batch.commit();
  }

  /**
   * Obtener asistencias de un día específico para un curso
   */
  async getAsistenciasDia(cursoId: string, fecha: Date): Promise<Asistencia[]> {
    const fechaNormalizada = normalizarFecha(fecha);
    const fechaStr = fechaNormalizada.toISOString().split('T')[0];

    // Usar query con where para filtrar por cursoId y fecha
    const asistenciasQuery = query(
      collection(this.firestore, 'asistencias'),
      where('cursoId', '==', cursoId),
      where('fecha', '==', Timestamp.fromDate(fechaNormalizada))
    );

    const snapshot = await getDocs(asistenciasQuery);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        cursoId: data['cursoId'],
        estudianteId: data['estudianteId'],
        fecha: data['fecha'].toDate(),
        estado: data['estado'] as EstadoAsistencia,
        puntaje: data['puntaje'],
        registradoPor: data['registradoPor'],
        fechaRegistro: data['fechaRegistro'].toDate()
      };
    });
  }

  /**
   * Verificar si existe registro de asistencia para un día específico
   */
  async existeRegistroDia(cursoId: string, fecha: Date): Promise<boolean> {
    const asistencias = await this.getAsistenciasDia(cursoId, fecha);
    return asistencias.length > 0;
  }

  /**
   * Obtener todas las asistencias de un estudiante en un curso
   */
  async getAsistenciasEstudiante(cursoId: string, estudianteId: string): Promise<Asistencia[]> {
    const asistenciasQuery = query(
      collection(this.firestore, 'asistencias'),
      where('cursoId', '==', cursoId),
      where('estudianteId', '==', estudianteId),
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(asistenciasQuery);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        cursoId: data['cursoId'],
        estudianteId: data['estudianteId'],
        fecha: data['fecha'].toDate(),
        estado: data['estado'] as EstadoAsistencia,
        puntaje: data['puntaje'],
        registradoPor: data['registradoPor'],
        fechaRegistro: data['fechaRegistro'].toDate()
      };
    });
  }

  /**
   * Calcular el promedio de asistencia de un estudiante (0-1)
   */
  async calcularPromedioAsistencia(cursoId: string, estudianteId: string): Promise<number> {
    const asistencias = await this.getAsistenciasEstudiante(cursoId, estudianteId);

    if (asistencias.length === 0) {
      return 0;
    }

    const sumaPuntajes = asistencias.reduce((sum, a) => sum + a.puntaje, 0);
    return sumaPuntajes / asistencias.length;
  }

  /**
   * Obtener todas las asistencias de un curso (para tabla)
   */
  async getAsistenciasCurso(cursoId: string): Promise<Map<string, Asistencia[]>> {
    const asistenciasQuery = query(
      collection(this.firestore, 'asistencias'),
      where('cursoId', '==', cursoId),
      orderBy('fecha', 'desc')
    );

    const snapshot = await getDocs(asistenciasQuery);
    const asistenciasMap = new Map<string, Asistencia[]>();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const asistencia: Asistencia = {
        id: doc.id,
        cursoId: data['cursoId'],
        estudianteId: data['estudianteId'],
        fecha: data['fecha'].toDate(),
        estado: data['estado'] as EstadoAsistencia,
        puntaje: data['puntaje'],
        registradoPor: data['registradoPor'],
        fechaRegistro: data['fechaRegistro'].toDate()
      };

      const estudianteId = asistencia.estudianteId;
      if (!asistenciasMap.has(estudianteId)) {
        asistenciasMap.set(estudianteId, []);
      }
      asistenciasMap.get(estudianteId)!.push(asistencia);
    });

    return asistenciasMap;
  }

  /**
   * Obtener estadísticas de asistencia del curso
   */
  async getEstadisticasCurso(cursoId: string): Promise<{
    totalRegistros: number;
    promedioGeneral: number;
    porEstado: Record<EstadoAsistencia, number>;
  }> {
    const asistenciasQuery = query(
      collection(this.firestore, 'asistencias'),
      where('cursoId', '==', cursoId)
    );

    const snapshot = await getDocs(asistenciasQuery);
    const asistencias = snapshot.docs.map(doc => doc.data());

    const totalRegistros = asistencias.length;
    const sumaPuntajes = asistencias.reduce((sum, a) => sum + (a['puntaje'] || 0), 0);
    const promedioGeneral = totalRegistros > 0 ? sumaPuntajes / totalRegistros : 0;

    const porEstado: Record<EstadoAsistencia, number> = {
      'P': 0,
      'T': 0,
      'F': 0,
      'J': 0
    };

    asistencias.forEach(a => {
      const estado = a['estado'] as EstadoAsistencia;
      if (estado in porEstado) {
        porEstado[estado]++;
      }
    });

    return {
      totalRegistros,
      promedioGeneral,
      porEstado
    };
  }
}
