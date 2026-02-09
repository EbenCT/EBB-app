export interface Calificacion {
  id: string;
  estudianteId: string;
  cursoId: string;
  tareaId?: string;
  examenId?: string;
  tipo: 'tarea' | 'examen';
  calificacion: number; // 0-100
  ponderacion: number; // %
  puntosFinal: number; // calificacion * ponderacion / 100
  fechaCalificacion: Date;
  retroalimentacion?: string;
  profesorId: string;
}
