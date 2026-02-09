export interface ProgresoEstudiante {
  id: string;
  estudianteId: string;
  cursoId: string;
  porcentajeAvance: number;
  leccionesCompletadas: string[];
  tareasEntregadas: string[];
  examenesRealizados: string[];
  calificacionActual: number;
  ultimaActividad: Date;
}
