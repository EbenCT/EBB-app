export interface ConfiguracionCalificacion {
  cursoId: string;
  elementos: ElementoCalificacion[];
  ponderacionAsistencia?: number; // % de la calificación final (default: 0)
}

export interface ElementoCalificacion {
  id: string;
  tipo: 'tarea' | 'examen';
  nombre: string;
  ponderacion: number; // %
}
