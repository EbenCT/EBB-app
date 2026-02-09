export interface Seccion {
  id: string;
  cursoId: string;
  titulo: string;
  descripcion: string;
  orden: number;
  desbloqueoProgresivo: boolean;
  prerequisitos?: string[]; // IDs de secciones previas
  requiereCompletarTodo: boolean; // Si debe completar todo el contenido antes de desbloquear siguiente
  porcentajeMinimo?: number; // % mínimo de progreso requerido (0-100)
  elementos: ElementoSeccion[]; // Lecciones, tareas, exámenes
}

export interface ProgresoSeccion {
  seccionId: string;
  estudianteId: string;
  leccionesCompletadas: string[];
  tareasEntregadas: string[];
  examenesRealizados: string[];
  porcentajeCompletado: number;
  bloqueada: boolean;
  cumpleRequisitos: boolean;
  seccionesPrerrequisito?: string[]; // IDs de secciones que bloquean esta
}

export interface ElementoSeccion {
  id: string;
  tipo: 'leccion' | 'examen'; // Las tareas ahora están dentro de lecciones
  orden: number;
}
