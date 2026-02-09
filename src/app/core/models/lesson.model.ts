export interface Leccion {
  id: string;
  seccionId: string;
  titulo: string;
  tipo: 'texto' | 'imagen' | 'pdf' | 'video';
  contenido: string;
  urlArchivo?: string;
  urlYoutube?: string;
  orden: number;
  tareas: string[]; // IDs de tareas asociadas a esta lección
  fechaCreacion: Date;
  // Retroalimentación (pregunta de 2 opciones antes de completar)
  preguntaRetroalimentacion?: {
    texto: string;
    opcionCorrecta: string;
    opcionIncorrecta: string;
  };
  // Progreso del estudiante (solo en runtime, no se guarda en BD de lecciones)
  completada?: boolean;
  fechaCompletado?: Date;
  respuestaRetroalimentacion?: string; // Respuesta dada por el estudiante
  correctaRetroalimentacion?: boolean; // Si respondió correctamente
}
