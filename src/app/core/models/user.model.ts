export type UserRole = 'admin' | 'profesor' | 'estudiante';

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: UserRole;
  fotoPerfil?: string | null;
  fechaRegistro: Date;
  activo: boolean;
  cursosInscritos?: string[]; // IDs de cursos (solo estudiantes)
  cursosAsignados?: string[]; // IDs de cursos (solo profesores)
}

export type UserModel = User;
