export interface Examen {
  id: string;
  seccionId: string;
  titulo: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date;
  duracionMinutos: number;
  intentosPermitidos: number;
  mostrarRespuestas: boolean;
  mezclarPreguntas: boolean;
  ponderacion: number; // %
  notaMinima: number;
  esExamenFinal?: boolean; // true si es el examen final del curso
  visible?: boolean; // Si es false o null, no se muestra a estudiantes
  preguntas: Pregunta[];
  fechaCreacion: Date;
}

export type TipoPregunta = 'multiple_unica' | 'multiple_multiple' | 'verdadero_falso' | 'corta' | 'completar';

export interface Pregunta {
  id: string;
  texto: string;
  tipo: TipoPregunta;
  opciones?: OpcionRespuesta[];
  respuestaCorrecta: string | string[];
  puntos: number;
  feedback?: string;
}

export interface OpcionRespuesta {
  id: string;
  texto: string;
  esCorrecta: boolean;
}

export interface IntentoExamen {
  id: string;
  examenId: string;
  estudianteId: string;
  numeroIntento: number;
  fechaInicio: Date;
  fechaFin?: Date;
  respuestas: RespuestaEstudiante[];
  calificacion?: number;
  estado: 'en_progreso' | 'finalizado' | 'tiempo_agotado';
  calificacionModificadaManualmente?: boolean;
  fechaModificacionCalificacion?: Date;
}

export interface RespuestaEstudiante {
  preguntaId: string;
  respuesta: string | string[];
  esCorrecta?: boolean;
  puntosObtenidos?: number;
}
