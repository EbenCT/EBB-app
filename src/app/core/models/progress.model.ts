export interface ProgresoLeccion {
  id: string;
  leccionId: string;
  estudianteId: string;
  completada: boolean;
  fechaCompletado?: Date;
  respuestaRetroalimentacion?: string; // Para preguntas de retroalimentación (feature #3)
  correctaRetroalimentacion?: boolean;
}

export interface ProgresoSeccion {
  seccionId: string;
  estudianteId: string;
  leccionesCompletadas: number;
  leccionesTotales: number;
  porcentajeCompletado: number;
  ultimaLeccionVista?: string;
}
