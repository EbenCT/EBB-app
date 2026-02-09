import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Observable, BehaviorSubject, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfiguracionHome, CONFIG_HOME_DEFAULT, ProfesorInfo } from '../models/config-home.model';

@Injectable({
  providedIn: 'root'
})
export class HomeConfigService {
  private configSubject = new BehaviorSubject<ConfiguracionHome | null>(null);
  public config$ = this.configSubject.asObservable();

  private readonly COLLECTION = 'configuracion-home';
  private readonly DOC_ID = 'principal';
  private readonly CACHE_KEY = 'home_config';
  private readonly CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 horas

  constructor(private firestore: Firestore) {}

  /**
   * Obtiene la configuración del home desde Firestore
   * Implementa caché de 2 horas en localStorage
   */
  async getConfiguracion(): Promise<ConfiguracionHome> {
    // 1. Intentar leer del caché
    const cached = this.getCachedConfig();
    if (cached) {
      this.configSubject.next(cached);
      return cached;
    }

    // 2. Leer de Firestore
    const config = await this.fetchFromFirestore();

    // 3. Guardar en caché
    this.cacheConfig(config);
    this.configSubject.next(config);

    return config;
  }

  /**
   * Obtiene la configuración como Observable
   */
  getConfiguracion$(): Observable<ConfiguracionHome> {
    return from(this.getConfiguracion());
  }

  /**
   * Actualiza la configuración completa
   * Solo para administradores
   */
  async updateConfiguracion(
    config: Partial<ConfiguracionHome>,
    adminId: string
  ): Promise<void> {
    const docRef = doc(this.firestore, this.COLLECTION, this.DOC_ID);

    const updateData = {
      ...config,
      ultimaActualizacion: new Date(),
      actualizadoPor: adminId
    };

    await updateDoc(docRef, updateData);

    // Invalidar caché
    this.clearCache();

    // Recargar configuración
    await this.getConfiguracion();
  }

  /**
   * Actualiza solo el Hero
   */
  async updateHero(heroConfig: ConfiguracionHome['hero'], adminId: string): Promise<void> {
    await this.updateConfiguracion({ hero: heroConfig }, adminId);
  }

  /**
   * Actualiza solo la sección Cursos
   */
  async updateSeccionCursos(cursosConfig: ConfiguracionHome['seccionCursos'], adminId: string): Promise<void> {
    await this.updateConfiguracion({ seccionCursos: cursosConfig }, adminId);
  }

  /**
   * Actualiza solo la sección Portfolio/Materias
   */
  async updateSeccionPortfolio(portfolioConfig: ConfiguracionHome['seccionPortfolio'], adminId: string): Promise<void> {
    await this.updateConfiguracion({ seccionPortfolio: portfolioConfig }, adminId);
  }

  /**
   * Actualiza solo la sección About/Timeline
   */
  async updateSeccionAbout(aboutConfig: ConfiguracionHome['seccionAbout'], adminId: string): Promise<void> {
    await this.updateConfiguracion({ seccionAbout: aboutConfig }, adminId);
  }

  /**
   * Actualiza solo la sección Profesores (título/subtítulo/footer)
   */
  async updateSeccionProfesores(profesoresConfig: ConfiguracionHome['seccionProfesores'], adminId: string): Promise<void> {
    await this.updateConfiguracion({ seccionProfesores: profesoresConfig }, adminId);
  }

  /**
   * Actualiza solo la sección Inscripción
   */
  async updateSeccionInscripcion(inscripcionConfig: ConfiguracionHome['seccionInscripcion'], adminId: string): Promise<void> {
    await this.updateConfiguracion({ seccionInscripcion: inscripcionConfig }, adminId);
  }

  /**
   * Actualiza solo la sección Footer
   */
  async updateSeccionFooter(footerConfig: ConfiguracionHome['footer'], adminId: string): Promise<void> {
    await this.updateConfiguracion({ footer: footerConfig }, adminId);
  }

  /**
   * Inicializa la configuración con valores por defecto
   * Se ejecuta una sola vez al crear el sistema
   */
  async inicializarConfiguracion(adminId: string): Promise<void> {
    const docRef = doc(this.firestore, this.COLLECTION, this.DOC_ID);

    const configInicial: ConfiguracionHome = {
      ...CONFIG_HOME_DEFAULT,
      ultimaActualizacion: new Date(),
      actualizadoPor: adminId
    };

    await setDoc(docRef, configInicial);
  }

  /**
   * Resetea la configuración a valores por defecto
   */
  async resetToDefault(adminId: string): Promise<void> {
    await this.inicializarConfiguracion(adminId);
    this.clearCache();
    await this.getConfiguracion();
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Lee la configuración desde Firestore
   */
  private async fetchFromFirestore(): Promise<ConfiguracionHome> {
    const docRef = doc(this.firestore, this.COLLECTION, this.DOC_ID);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Si no existe, crear con valores por defecto
      console.warn('Configuración del home no encontrada. Creando configuración por defecto...');
      const configDefault: ConfiguracionHome = {
        ...CONFIG_HOME_DEFAULT,
        ultimaActualizacion: new Date(),
        actualizadoPor: 'sistema'
      };
      await setDoc(docRef, configDefault);
      return configDefault;
    }

    const data = docSnap.data();
    return {
      ...data,
      ultimaActualizacion: data['ultimaActualizacion']?.toDate() || new Date()
    } as ConfiguracionHome;
  }

  /**
   * Lee la configuración del caché (localStorage)
   */
  private getCachedConfig(): ConfiguracionHome | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);

      // Verificar que no haya expirado
      if (Date.now() - data.timestamp > this.CACHE_DURATION) {
        this.clearCache();
        return null;
      }

      // Convertir fecha
      if (data.config.ultimaActualizacion) {
        data.config.ultimaActualizacion = new Date(data.config.ultimaActualizacion);
      }

      return data.config;
    } catch (error) {
      console.error('Error leyendo caché del home:', error);
      this.clearCache();
      return null;
    }
  }

  /**
   * Guarda la configuración en caché
   */
  private cacheConfig(config: ConfiguracionHome): void {
    try {
      const cacheData = {
        config,
        timestamp: Date.now()
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error guardando caché del home:', error);
    }
  }

  /**
   * Limpia el caché
   */
  clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * Obtiene los profesores desde la colección de usuarios
   * Filtra por rol 'profesor' o 'docente'
   */
  async getProfesores(): Promise<ProfesorInfo[]> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('rol', 'in', ['profesor', 'docente']));
      const querySnapshot = await getDocs(q);

      // Obtener todos los cursos de Firestore para mapear IDs a nombres
      const cursosRef = collection(this.firestore, 'cursos');
      const cursosSnapshot = await getDocs(cursosRef);
      const cursosMap = new Map<string, string>();

      // Crear mapa de ID -> nombre de curso desde Firestore
      cursosSnapshot.forEach((cursoDoc) => {
        const cursoData = cursoDoc.data();
        const nombreCurso = cursoData['nombre'] || cursoData['titulo'] || cursoDoc.id;
        cursosMap.set(cursoDoc.id, nombreCurso);
      });

      console.log('📚 Cursos cargados desde Firestore:', Array.from(cursosMap.entries()));

      const profesores: ProfesorInfo[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Construir nombre completo concatenando nombre + apellido
        const nombre = data['nombre'] || '';
        const apellido = data['apellido'] || '';
        const nombreCompleto = `${nombre} ${apellido}`.trim() || 'Sin nombre';

        // Foto de perfil
        const fotoPerfil = data['fotoPerfil'] || 'assets/img/team/default.jpg';

        // Especialidad: mostrar cursos asignados con sus nombres
        let especialidad = '';
        if (data['cursosAsignados'] && Array.isArray(data['cursosAsignados']) && data['cursosAsignados'].length > 0) {
          console.log('🔍 Cursos asignados para', nombreCompleto, ':', data['cursosAsignados']);

          // Mapear IDs a nombres de cursos
          const nombresCursos = data['cursosAsignados']
            .map((cursoId: string) => {
              const nombreCurso = cursosMap.get(cursoId);
              console.log(`  Mapeando ID "${cursoId}" -> "${nombreCurso || 'NO ENCONTRADO'}"`);
              return nombreCurso || cursoId;
            })
            .filter((nombre: string) => nombre); // Filtrar vacíos

          especialidad = nombresCursos.length > 0
            ? nombresCursos.join(', ')
            : 'Materias por asignar';
        } else {
          // Si no tiene cursos, usar especialidad personalizada o texto por defecto
          especialidad = data['especialidad'] || 'Materias por asignar';
        }

        profesores.push({
          uid: doc.id,
          nombreCompleto: nombreCompleto,
          nombre: nombreCompleto, // Alias para HTML
          email: data['email'] || '',
          fotoPerfil: fotoPerfil,
          foto: fotoPerfil, // Alias para HTML
          especialidad: especialidad,
          descripcion: especialidad, // Alias para HTML
          redesSociales: data['redesSociales'] || {}
        });
      });

      console.log('🎓 Total profesores cargados desde Firestore:', profesores.length);
      return profesores;
    } catch (error) {
      console.error('Error obteniendo profesores:', error);
      return [];
    }
  }
}
