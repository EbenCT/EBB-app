import { Injectable } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, Timestamp, writeBatch } from '@angular/fire/firestore';
import { Observable, from, map, switchMap, combineLatest, of } from 'rxjs';
import {
  ConfiguracionCalificacion,
  CalificacionEstudiante,
  ProgresoEstudiante,
  EstadisticaCurso,
  LibroCalificaciones,
  FilaLibroCalificaciones,
  ColumnaCalificacion
} from '../models/grading.model';
import { Calificacion } from '../models/grade.model';
import { IntentoExamen } from '../models/exam.model';
import { Tarea } from '../models/task.model';
import { Examen } from '../models/exam.model';
import { AsistenciaService } from './asistencia.service';

@Injectable({
  providedIn: 'root'
})
export class GradingService {
  private configuracionCollection = 'configuracionCalificaciones';
  private calificacionesCollection = 'calificacionesEstudiantes';
  private progresoCollection = 'progresoEstudiantes';

  constructor(
    private firestore: Firestore,
    private asistenciaService: AsistenciaService
  ) {}

  // ========== CONFIGURACIÓN DE CALIFICACIONES ==========

  async createConfiguracion(config: ConfiguracionCalificacion): Promise<string> {
    // Validar que las ponderaciones sumen 100
    const ponderacionAsistencia = config.ponderacionAsistencia || 0;
    const ponderacionExamenFinal = config.ponderacionExamenFinal || 0;
    if (config.ponderacionTareas + config.ponderacionExamenes + ponderacionAsistencia + ponderacionExamenFinal !== 100) {
      throw new Error('Las ponderaciones deben sumar 100%');
    }

    const docRef = await addDoc(collection(this.firestore, this.configuracionCollection), {
      ...config,
      ponderacionAsistencia,
      fechaCreacion: Timestamp.now(),
      fechaModificacion: Timestamp.now()
    });
    return docRef.id;
  }

  async updateConfiguracion(id: string, config: Partial<ConfiguracionCalificacion>): Promise<void> {
    // Validar ponderaciones si se actualizan
    if (config.ponderacionTareas !== undefined || config.ponderacionExamenes !== undefined ||
        config.ponderacionAsistencia !== undefined || config.ponderacionExamenFinal !== undefined) {
      const docSnap = await getDoc(doc(this.firestore, this.configuracionCollection, id));
      const currentConfig = docSnap.data() as ConfiguracionCalificacion;

      const newPonderacionTareas = config.ponderacionTareas ?? currentConfig.ponderacionTareas;
      const newPonderacionExamenes = config.ponderacionExamenes ?? currentConfig.ponderacionExamenes;
      const newPonderacionAsistencia = config.ponderacionAsistencia ?? (currentConfig.ponderacionAsistencia || 0);
      const newPonderacionExamenFinal = config.ponderacionExamenFinal ?? (currentConfig.ponderacionExamenFinal || 0);

      if (newPonderacionTareas + newPonderacionExamenes + newPonderacionAsistencia + newPonderacionExamenFinal !== 100) {
        throw new Error('Las ponderaciones deben sumar 100%');
      }
    }

    const docRef = doc(this.firestore, this.configuracionCollection, id);
    await updateDoc(docRef, {
      ...config,
      fechaModificacion: Timestamp.now()
    });
  }

  async getConfiguracionByCurso(cursoId: string): Promise<ConfiguracionCalificacion | null> {
    const q = query(
      collection(this.firestore, this.configuracionCollection),
      where('cursoId', '==', cursoId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as ConfiguracionCalificacion;
  }

  // ========== CÁLCULO DE CALIFICACIONES ==========

  async calcularCalificacionEstudiante(estudianteId: string, cursoId: string): Promise<CalificacionEstudiante> {
    // Obtener configuración del curso
    const config = await this.getConfiguracionByCurso(cursoId);
    if (!config) {
      throw new Error('No existe configuración de calificaciones para este curso');
    }

    // Obtener todas las calificaciones de tareas
    const qTareas = query(
      collection(this.firestore, 'calificaciones'),
      where('estudianteId', '==', estudianteId),
      where('cursoId', '==', cursoId)
    );
    const tareasSnapshot = await getDocs(qTareas);
    const calificacionesTareas = tareasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Calificacion));

    // Obtener todos los intentos de exámenes (tomar el mejor intento)
    const qExamenes = query(
      collection(this.firestore, 'intentos'),
      where('estudianteId', '==', estudianteId)
    );
    const examenesSnapshot = await getDocs(qExamenes);
    const intentosExamenes = examenesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IntentoExamen));

    // Obtener datos de los exámenes para saber cuáles son finales
    const examenesIds = [...new Set(intentosExamenes.map(i => i.examenId))];
    const examenesData = new Map<string, Examen>();
    for (const examenId of examenesIds) {
      const examenDoc = await getDoc(doc(this.firestore, 'examenes', examenId));
      if (examenDoc.exists()) {
        examenesData.set(examenId, { id: examenDoc.id, ...examenDoc.data() } as Examen);
      }
    }

    // Filtrar y agrupar intentos por examen (tomar el mejor)
    // Separar exámenes prácticos de examen final
    const mejoresIntentosPracticosMap = new Map<string, IntentoExamen>();
    let mejorIntentoFinal: IntentoExamen | null = null;

    for (const intento of intentosExamenes) {
      if (intento.estado === 'finalizado' && intento.calificacion !== undefined) {
        const examen = examenesData.get(intento.examenId);

        if (examen?.esExamenFinal) {
          // Es examen final, guardar el mejor
          if (!mejorIntentoFinal || (intento.calificacion ?? 0) > (mejorIntentoFinal.calificacion ?? 0)) {
            mejorIntentoFinal = intento;
          }
        } else {
          // Es examen práctico, agrupar por examenId
          const mejor = mejoresIntentosPracticosMap.get(intento.examenId);
          if (!mejor || (intento.calificacion ?? 0) > (mejor.calificacion ?? 0)) {
            mejoresIntentosPracticosMap.set(intento.examenId, intento);
          }
        }
      }
    }

    // Calcular promedio de tareas
    const promedioTareas = calificacionesTareas.length > 0
      ? calificacionesTareas.reduce((sum, cal) => sum + cal.puntosFinal, 0) / calificacionesTareas.length
      : 0;

    // Calcular promedio de exámenes prácticos (sin incluir final)
    const promedioExamenes = mejoresIntentosPracticosMap.size > 0
      ? Array.from(mejoresIntentosPracticosMap.values()).reduce((sum, intento) => sum + (intento.calificacion ?? 0), 0) / mejoresIntentosPracticosMap.size
      : 0;

    // Calificación del examen final
    const calificacionExamenFinal = mejorIntentoFinal ? (mejorIntentoFinal.calificacion ?? 0) : 0;

    // Calcular promedio de asistencia (0-1, luego se multiplica por 100 para la escala)
    const promedioAsistencia = await this.asistenciaService.calcularPromedioAsistencia(cursoId, estudianteId);
    const promedioAsistenciaEscala = promedioAsistencia * 100; // Convertir a escala 0-100

    // Calcular calificación final ponderada
    const ponderacionAsistencia = config.ponderacionAsistencia || 0;
    const ponderacionExamenFinal = config.ponderacionExamenFinal || 0;

    const calificacionFinal =
      (promedioTareas * config.ponderacionTareas / 100) +
      (promedioExamenes * config.ponderacionExamenes / 100) +
      (calificacionExamenFinal * ponderacionExamenFinal / 100) +
      (promedioAsistenciaEscala * ponderacionAsistencia / 100);

    // Determinar estado
    const estado = calificacionFinal >= config.notaMinima ? 'aprobado' :
                   (calificacionesTareas.length === 0 && mejoresIntentosPracticosMap.size === 0) ? 'en_progreso' : 'desaprobado';

    return {
      estudianteId,
      cursoId,
      calificaciones: [],
      promedioTareas,
      promedioExamenes,
      promedioExamenFinal: calificacionExamenFinal,
      calificacionFinal: Math.round(calificacionFinal * 100) / 100,
      estado,
      fechaActualizacion: new Date()
    };
  }

  // ========== LIBRO DE CALIFICACIONES ==========

  async getLibroCalificaciones(cursoId: string): Promise<LibroCalificaciones> {
    // Obtener configuración
    const config = await this.getConfiguracionByCurso(cursoId);
    if (!config) {
      throw new Error('No existe configuración de calificaciones para este curso');
    }

    // Obtener curso
    const cursoDoc = await getDoc(doc(this.firestore, 'cursos', cursoId));
    const curso = cursoDoc.data();
    const estudiantesIds: string[] = curso?.['estudiantes'] || [];

    // Obtener información de estudiantes
    const estudiantesPromises = estudiantesIds.map(async (id) => {
      const userDoc = await getDoc(doc(this.firestore, 'users', id));
      return { id, ...userDoc.data() } as any;
    });
    const estudiantesData = await Promise.all(estudiantesPromises);

    // Obtener todas las tareas y exámenes del curso
    const seccionesQuery = query(
      collection(this.firestore, 'secciones'),
      where('cursoId', '==', cursoId)
    );
    const seccionesSnapshot = await getDocs(seccionesQuery);
    const seccionesIds = seccionesSnapshot.docs.map(doc => doc.id);

    // Obtener tareas
    const tareasPromises = seccionesIds.map(seccionId =>
      getDocs(query(collection(this.firestore, 'tareas'), where('seccionId', '==', seccionId)))
    );
    const tareasSnapshots = await Promise.all(tareasPromises);
    const tareas = tareasSnapshots.flatMap(snapshot =>
      snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    );

    // Obtener exámenes
    const examenesPromises = seccionesIds.map(seccionId =>
      getDocs(query(collection(this.firestore, 'examenes'), where('seccionId', '==', seccionId)))
    );
    const examenesSnapshots = await Promise.all(examenesPromises);
    const examenes = examenesSnapshots.flatMap(snapshot =>
      snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    );

    // Construir columnas
    const columnas: ColumnaCalificacion[] = [
      ...tareas.map((t, idx) => ({
        id: t.id!,
        tipo: 'tarea' as const,
        titulo: t['titulo'],
        puntosMaximos: 100,
        orden: idx
      })),
      ...examenes.map((e, idx) => ({
        id: e.id!,
        tipo: 'examen' as const,
        titulo: e['titulo'],
        puntosMaximos: 100,
        orden: tareas.length + idx
      }))
    ];

    // Obtener calificaciones de todos los estudiantes
    const filasPromises = estudiantesData.map(async (estudiante) => {
      const calificacion = await this.calcularCalificacionEstudiante(estudiante.id, cursoId);

      // Obtener calificaciones individuales de tareas
      const tareasMap: { [key: string]: number | null } = {};
      for (const tarea of tareas) {
        const qCal = query(
          collection(this.firestore, 'calificaciones'),
          where('estudianteId', '==', estudiante.id),
          where('tareaId', '==', tarea.id)
        );
        const calSnapshot = await getDocs(qCal);
        tareasMap[tarea.id!] = calSnapshot.empty ? null : calSnapshot.docs[0].data()['puntosFinal'];
      }

      // Obtener calificaciones individuales de exámenes (mejor intento)
      const examenesMap: { [key: string]: number | null } = {};
      for (const examen of examenes) {
        const qIntento = query(
          collection(this.firestore, 'intentosExamenes'),
          where('estudianteId', '==', estudiante.id),
          where('examenId', '==', examen.id),
          where('estado', '==', 'finalizado')
        );
        const intentosSnapshot = await getDocs(qIntento);
        if (!intentosSnapshot.empty) {
          const mejorIntento = intentosSnapshot.docs
            .map(d => d.data())
            .reduce((mejor, actual) =>
              (actual['calificacion'] ?? 0) > (mejor['calificacion'] ?? 0) ? actual : mejor
            );
          examenesMap[examen.id!] = mejorIntento['calificacion'] ?? null;
        } else {
          examenesMap[examen.id!] = null;
        }
      }

      // Obtener promedio de asistencia
      const promedioAsistencia = await this.asistenciaService.calcularPromedioAsistencia(cursoId, estudiante.id);
      const asistencias = await this.asistenciaService.getAsistenciasEstudiante(cursoId, estudiante.id);

      const fila: FilaLibroCalificaciones = {
        estudianteId: estudiante.id,
        nombreEstudiante: `${estudiante['nombre']} ${estudiante['apellido']}`,
        email: estudiante['email'],
        tareas: tareasMap,
        examenes: examenesMap,
        promedioTareas: calificacion.promedioTareas,
        promedioExamenes: calificacion.promedioExamenes,
        calificacionExamenFinal: calificacion.promedioExamenFinal,
        promedioAsistencia: Math.round(promedioAsistencia * 100 * 100) / 100, // Convertir a escala 0-100 con 2 decimales
        totalAsistencias: asistencias.length,
        calificacionFinal: calificacion.calificacionFinal,
        estado: calificacion.estado
      };

      return fila;
    });

    const filas = await Promise.all(filasPromises);

    return {
      cursoId,
      cursoTitulo: curso?.['titulo'] || 'Sin título',
      estudiantes: filas,
      configuracion: config,
      columnas
    };
  }

  // ========== PROGRESO DEL ESTUDIANTE ==========

  async calcularProgreso(estudianteId: string, cursoId: string): Promise<ProgresoEstudiante> {
    // Obtener secciones del curso
    const seccionesQuery = query(
      collection(this.firestore, 'secciones'),
      where('cursoId', '==', cursoId)
    );
    const seccionesSnapshot = await getDocs(seccionesQuery);
    const seccionesIds = seccionesSnapshot.docs.map(doc => doc.id);

    // Obtener todas las lecciones
    const leccionesPromises = seccionesIds.map(seccionId =>
      getDocs(query(collection(this.firestore, 'lecciones'), where('seccionId', '==', seccionId)))
    );
    const leccionesSnapshots = await Promise.all(leccionesPromises);
    const leccionesTotales = leccionesSnapshots.reduce((sum, snapshot) => sum + snapshot.size, 0);

    // Obtener todas las tareas visibles (buscar por leccionId, no seccionId)
    const leccionesIds = leccionesSnapshots.flatMap(snapshot => snapshot.docs.map(doc => doc.id));
    const tareasPromises = leccionesIds.map(leccionId =>
      getDocs(query(collection(this.firestore, 'tareas'), where('leccionId', '==', leccionId)))
    );
    const tareasSnapshots = await Promise.all(tareasPromises);
    const tareas = tareasSnapshots.flatMap(snapshot =>
      snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data['visible'] !== false; // Incluir si visible es true o undefined
        })
        .map(doc => doc.id)
    );

    // Obtener entregas de tareas
    const entregasQuery = query(
      collection(this.firestore, 'entregas'),
      where('estudianteId', '==', estudianteId)
    );
    const entregasSnapshot = await getDocs(entregasQuery);
    const tareasEntregadas = entregasSnapshot.docs
      .map(doc => doc.data()['tareaId'])
      .filter((id: string) => tareas.includes(id));

    // Obtener todos los exámenes visibles (filtrar los no visibles)
    const examenesPromises = seccionesIds.map(seccionId =>
      getDocs(query(collection(this.firestore, 'examenes'), where('seccionId', '==', seccionId)))
    );
    const examenesSnapshots = await Promise.all(examenesPromises);
    const examenes = examenesSnapshots.flatMap(snapshot =>
      snapshot.docs
        .filter(doc => {
          const data = doc.data();
          return data['visible'] !== false; // Incluir si visible es true o undefined
        })
        .map(doc => doc.id)
    );

    // Obtener intentos de exámenes finalizados
    const intentosQuery = query(
      collection(this.firestore, 'intentos'),
      where('estudianteId', '==', estudianteId),
      where('estado', '==', 'finalizado')
    );
    const intentosSnapshot = await getDocs(intentosQuery);
    const examenesRealizados = [...new Set(
      intentosSnapshot.docs
        .map(doc => doc.data()['examenId'])
        .filter((id: string) => examenes.includes(id))
    )];

    // Obtener lecciones completadas
    const leccionesCompletadasQuery = query(
      collection(this.firestore, 'progresoLecciones'),
      where('estudianteId', '==', estudianteId),
      where('completada', '==', true)
    );
    const leccionesCompletadasSnapshot = await getDocs(leccionesCompletadasQuery);
    const leccionesCompletadas = leccionesCompletadasSnapshot.docs
      .map(doc => doc.data()['leccionId'])
      .filter((id: string) => leccionesIds.includes(id)); // Solo contar lecciones de este curso

    // Calcular calificación actual
    const calificacion = await this.calcularCalificacionEstudiante(estudianteId, cursoId);

    // Calcular porcentaje de avance (AHORA INCLUYE LECCIONES)
    const totalElementos = leccionesTotales + tareas.length + examenes.length;
    const elementosCompletados = leccionesCompletadas.length + tareasEntregadas.length + examenesRealizados.length;
    const porcentajeAvance = totalElementos > 0 ? Math.round((elementosCompletados / totalElementos) * 100) : 0;

    return {
      estudianteId,
      cursoId,
      porcentajeAvance,
      leccionesCompletadas,
      leccionesTotales,
      tareasEntregadas,
      tareasTotales: tareas.length,
      examenesRealizados,
      examenesTotales: examenes.length,
      calificacionActual: calificacion.calificacionFinal,
      ultimaActividad: new Date()
    };
  }

  // ========== ESTADÍSTICAS DEL CURSO ==========

  async getEstadisticasCurso(cursoId: string): Promise<EstadisticaCurso> {
    const libro = await this.getLibroCalificaciones(cursoId);
    const config = libro.configuracion;

    const totalEstudiantes = libro.estudiantes.length;
    const estudiantesAprobados = libro.estudiantes.filter(e => e.estado === 'aprobado').length;
    const estudiantesDesaprobados = libro.estudiantes.filter(e => e.estado === 'desaprobado').length;
    const estudiantesEnProgreso = libro.estudiantes.filter(e => e.estado === 'en_progreso').length;

    const promedioGeneral = totalEstudiantes > 0
      ? libro.estudiantes.reduce((sum, e) => sum + e.calificacionFinal, 0) / totalEstudiantes
      : 0;

    const tasaAprobacion = totalEstudiantes > 0
      ? (estudiantesAprobados / totalEstudiantes) * 100
      : 0;

    // Distribución de notas según escala
    const escala = config.escalaCalificacion;
    const distribucion = {
      excelente: libro.estudiantes.filter(e => e.calificacionFinal >= (escala.excelente ?? 90)).length,
      bueno: libro.estudiantes.filter(e =>
        e.calificacionFinal >= (escala.bueno ?? 75) && e.calificacionFinal < (escala.excelente ?? 90)
      ).length,
      regular: libro.estudiantes.filter(e =>
        e.calificacionFinal >= (escala.regular ?? config.notaMinima) && e.calificacionFinal < (escala.bueno ?? 75)
      ).length,
      desaprobado: libro.estudiantes.filter(e => e.calificacionFinal < config.notaMinima).length
    };

    return {
      cursoId,
      totalEstudiantes,
      estudiantesAprobados,
      estudiantesDesaprobados,
      estudiantesEnProgreso,
      promedioGeneral: Math.round(promedioGeneral * 100) / 100,
      tasaAprobacion: Math.round(tasaAprobacion * 100) / 100,
      distribucionNotas: distribucion
    };
  }
}
