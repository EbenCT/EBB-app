import { ConfiguracionCalificacion } from './grade-config.model';

export interface Curso {
  id: string;
  titulo: string;
  descripcion: string;
  imagen?: string;
  profesorId: string;
  fechaCreacion: Date;
  activo: boolean;
  estudiantes: string[]; // IDs de estudiantes
  secciones: string[]; // IDs de secciones
  configuracionCalificaciones: ConfiguracionCalificacion;
}
