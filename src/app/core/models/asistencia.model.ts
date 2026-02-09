/**
 * Modelo de Asistencia
 * Representa el registro de asistencia de un estudiante en un curso para una fecha específica
 */

export type EstadoAsistencia = 'P' | 'T' | 'F' | 'J';

export interface Asistencia {
  id?: string;
  cursoId: string;
  estudianteId: string;
  fecha: Date; // Solo fecha (normalizada sin hora)
  estado: EstadoAsistencia;
  puntaje: number; // P:1, T:0.5, F:0, J:0.75
  registradoPor: string; // uid del profesor/admin
  fechaRegistro: Date; // timestamp completo del registro
}

/**
 * Helper para convertir estado a puntaje
 */
export function estadoAPuntaje(estado: EstadoAsistencia): number {
  const puntajes: Record<EstadoAsistencia, number> = {
    'P': 1,    // Presente
    'T': 0.5,  // Tarde
    'F': 0,    // Falta
    'J': 0.75  // Justificado
  };
  return puntajes[estado];
}

/**
 * Helper para obtener el nombre completo del estado
 */
export function estadoATexto(estado: EstadoAsistencia): string {
  const textos: Record<EstadoAsistencia, string> = {
    'P': 'Presente',
    'T': 'Tarde',
    'F': 'Falta',
    'J': 'Falta Justificada'
  };
  return textos[estado];
}

/**
 * Helper para normalizar fecha (solo día, sin hora)
 */
export function normalizarFecha(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Interfaz para el formulario de registro masivo
 */
export interface RegistroAsistenciaEstudiante {
  estudianteId: string;
  nombreEstudiante: string;
  estado?: EstadoAsistencia; // undefined = no marcado
}
