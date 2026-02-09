export interface SolicitudInscripcion {
  id: string;
  estudianteId: string;        // UID del estudiante
  estudianteNombre: string;     // Nombre completo para mostrar
  estudianteEmail: string;      // Email para referencia
  cursoId: string;              // ID del curso solicitado
  cursoNombre: string;          // Nombre del curso
  fechaSolicitud: Date;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  motivoRechazo?: string;       // Si el admin rechaza, puede dar razón
  fechaRespuesta?: Date;        // Cuándo se aceptó/rechazó
  respondidoPor?: string;       // ID del admin que respondió
}
