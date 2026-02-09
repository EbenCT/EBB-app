import { Injectable, inject } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  user,
  User,
  UserCredential,
  signInWithPopup,
  GoogleAuthProvider,
  getAuth
} from '@angular/fire/auth';
import { FirebaseApp, initializeApp, deleteApp } from '@angular/fire/app';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from '@angular/fire/firestore';
import { Observable, from, of, switchMap } from 'rxjs';
import { UserModel, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private app = inject(FirebaseApp);

  // Observable del usuario autenticado
  user$ = user(this.auth);

  // Observable del perfil completo del usuario
  userProfile$: Observable<UserModel | null> = this.user$.pipe(
    switchMap(user => {
      if (!user) return of(null);
      return from(this.getUserProfile(user.uid));
    })
  );

  constructor() {}

  /**
   * Login con email y contraseña
   */
  async login(email: string, password: string): Promise<UserCredential> {
    try {
      return await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  /**
   * Registro de nuevo usuario por Admin (sin cerrar sesión del admin)
   * Usa una aplicación Firebase secundaria para no afectar la sesión actual
   */
  async registerByAdmin(
    email: string,
    password: string,
    userData: Partial<UserModel>
  ): Promise<void> {
    let secondaryApp;
    try {
      // Verificar que hay un admin autenticado
      if (!this.auth.currentUser) {
        throw new Error('Debes estar autenticado como admin para crear usuarios');
      }

      // Crear una aplicación Firebase secundaria completamente separada
      secondaryApp = initializeApp(environment.firebase, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);

      // Crear nuevo usuario en la instancia secundaria (no afecta la sesión principal)
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );

      // Crear perfil en Firestore
      await this.createUserProfile(userCredential.user.uid, {
        email,
        ...userData
      });

      // Cerrar la sesión de la instancia secundaria
      await signOut(secondaryAuth);

      // Eliminar la aplicación secundaria para limpiar recursos
      await deleteApp(secondaryApp);

    } catch (error) {
      console.error('Error en registro:', error);
      // Limpiar la app secundaria en caso de error
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (cleanupError) {
          console.error('Error limpiando app secundaria:', cleanupError);
        }
      }
      throw error;
    }
  }

  /**
   * Cerrar sesión
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Error en logout:', error);
      throw error;
    }
  }

  /**
   * Obtener perfil de usuario desde Firestore
   */
  async getUserProfile(uid: string): Promise<UserModel | null> {
    try {
      const userDocRef = doc(this.firestore, `users/${uid}`);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return userDoc.data() as UserModel;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      return null;
    }
  }

  /**
   * Crear perfil de usuario en Firestore
   */
  private async createUserProfile(
    uid: string,
    data: Partial<UserModel>
  ): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, `users/${uid}`);
      const userData: UserModel = {
        id: uid,
        email: data.email!,
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        rol: data.rol || 'estudiante',
        fotoPerfil: data.fotoPerfil || null,
        fechaRegistro: new Date(),
        activo: true,
        cursosInscritos: [],
        cursosAsignados: []
      };

      await setDoc(userDocRef, userData);
    } catch (error) {
      console.error('Error creando perfil:', error);
      throw error;
    }
  }

  /**
   * Actualizar perfil de usuario
   */
  async updateUserProfile(uid: string, data: Partial<UserModel>): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, `users/${uid}`);
      await updateDoc(userDocRef, data as any);
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario actual de Firebase Auth
   */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /**
   * Obtener perfil completo del usuario actual con datos de Firestore
   */
  async getCurrentUserProfile(): Promise<UserModel | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    return this.getUserProfile(user.uid);
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  /**
   * Registro público de estudiantes (auto-login incluido)
   * No requiere app secundaria porque el usuario se loguea automáticamente
   */
  async registerPublic(
    email: string,
    password: string,
    nombre: string,
    apellido: string
  ): Promise<void> {
    try {
      // Crear usuario con email y contraseña
      const userCredential = await createUserWithEmailAndPassword(
        this.auth,
        email,
        password
      );

      // Crear perfil en Firestore con rol de estudiante fijo
      await this.createUserProfile(userCredential.user.uid, {
        email,
        nombre,
        apellido,
        rol: 'estudiante',  // Siempre estudiante para registro público
        fotoPerfil: null
      });

      console.log('✅ Usuario registrado como estudiante');
    } catch (error) {
      console.error('Error en registro público:', error);
      throw error;
    }
  }

  /**
   * Login con Google (auto-registro si no existe)
   */
  async loginWithGoogle(): Promise<UserCredential> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);

      // Verificar si el usuario ya existe en Firestore
      const userDoc = await this.getUserProfile(result.user.uid);

      // Si no existe, crear perfil básico con rol estudiante
      if (!userDoc) {
        await this.createUserProfile(result.user.uid, {
          email: result.user.email || '',
          nombre: result.user.displayName?.split(' ')[0] || '',
          apellido: result.user.displayName?.split(' ').slice(1).join(' ') || '',
          rol: 'estudiante',  // Siempre estudiante para login público con Google
          fotoPerfil: result.user.photoURL || undefined
        });
      }

      return result;
    } catch (error) {
      console.error('Error en login con Google:', error);
      throw error;
    }
  }
}
