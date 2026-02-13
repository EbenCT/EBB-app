import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HomeConfigService } from '../../../core/services/home-config.service';
import { AuthService } from '../../../core/services/auth.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { ConfiguracionHome, CONFIG_HOME_DEFAULT, ProfesorInfo } from '../../../core/models/config-home.model';

@Component({
  selector: 'app-configurar-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './configurar-home.component.html',
  styleUrl: './configurar-home.component.scss'
})
export class ConfigurarHomeComponent implements OnInit {
  heroForm!: FormGroup;
  cursosForm!: FormGroup;
  portfolioForm!: FormGroup;
  aboutForm!: FormGroup;
  profesoresForm!: FormGroup;
  inscripcionForm!: FormGroup;
  footerForm!: FormGroup;
  config: ConfiguracionHome | null = null;
  loading = true;
  saving = false;
  uploadingImage = false;
  currentUserId: string = '';
  mensaje: { tipo: 'success' | 'error' | 'info'; texto: string } | null = null;

  // Profesores cargados desde Firestore
  profesoresReales: ProfesorInfo[] = [];
  loadingProfesores = false;

  // Tabs de navegación
  tabActiva: 'hero' | 'cursos' | 'portfolio' | 'about' | 'profesores' | 'inscripcion' | 'footer' = 'hero';

  // Lista de iconos disponibles para cursos
  iconosDisponibles = [
    { clase: 'fa-book-reader', nombre: 'Libro y Lector' },
    { clase: 'fa-graduation-cap', nombre: 'Birrete de Graduación' },
    { clase: 'fa-book-open', nombre: 'Libro Abierto' },
    { clase: 'fa-book', nombre: 'Libro' },
    { clase: 'fa-bible', nombre: 'Biblia' },
    { clase: 'fa-cross', nombre: 'Cruz' },
    { clase: 'fa-church', nombre: 'Iglesia' },
    { clase: 'fa-pray', nombre: 'Oración' },
    { clase: 'fa-hands-praying', nombre: 'Manos Orando' },
    { clase: 'fa-dove', nombre: 'Paloma' },
    { clase: 'fa-user-graduate', nombre: 'Estudiante Graduado' },
    { clase: 'fa-chalkboard-teacher', nombre: 'Profesor' },
    { clase: 'fa-pencil-alt', nombre: 'Lápiz' },
    { clase: 'fa-scroll', nombre: 'Pergamino' },
    { clase: 'fa-crown', nombre: 'Corona' },
    { clase: 'fa-heart', nombre: 'Corazón' },
    { clase: 'fa-star', nombre: 'Estrella' },
    { clase: 'fa-lightbulb', nombre: 'Idea/Luz' },
    { clase: 'fa-seedling', nombre: 'Semilla/Crecimiento' },
    { clase: 'fa-hands', nombre: 'Manos' },
    { clase: 'fa-users', nombre: 'Grupo de Personas' },
    { clase: 'fa-user-friends', nombre: 'Amigos' },
    { clase: 'fa-certificate', nombre: 'Certificado' },
    { clase: 'fa-award', nombre: 'Premio' }
  ];

  constructor(
    private fb: FormBuilder,
    private homeConfigService: HomeConfigService,
    private authService: AuthService,
    private cloudinaryService: CloudinaryService,
    private router: Router
  ) {}

  async ngOnInit() {
    // Obtener usuario actual
    this.authService.userProfile$.subscribe(profile => {
      if (profile) {
        this.currentUserId = profile.id || '';

        // Verificar que sea admin
        if (profile.rol !== 'admin') {
          this.router.navigate(['/']);
          return;
        }
      }
    });

    // Crear formulario Hero
    this.heroForm = this.fb.group({
      subtitulo1: ['', Validators.required],
      subtitulo2: ['', Validators.required],
      titulo: ['', Validators.required],
      botonTexto: ['', Validators.required],
      botonLink: ['', Validators.required],
      imagenFondo: ['']
    });

    // Crear formulario Cursos
    this.cursosForm = this.fb.group({
      visible: [true],
      titulo: ['', Validators.required],
      subtitulo: ['', Validators.required],
      cursos: this.fb.array([])
    });

    // Crear formulario Portfolio
    this.portfolioForm = this.fb.group({
      visible: [true],
      titulo: ['', Validators.required],
      subtitulo: ['', Validators.required],
      materias: this.fb.array([])
    });

    // Crear formulario About/Timeline
    this.aboutForm = this.fb.group({
      visible: [true],
      titulo: ['', Validators.required],
      subtitulo: ['', Validators.required],
      items: this.fb.array([]),
      itemFinal: this.fb.group({
        linea1: ['', Validators.required],
        linea2: ['', Validators.required],
        linea3: ['', Validators.required]
      })
    });

    // Crear formulario Profesores
    this.profesoresForm = this.fb.group({
      visible: [true],
      titulo: ['', Validators.required],
      subtitulo: ['', Validators.required],
      descripcionPie: ['', Validators.required],
      usarProfesoresReales: [false]
    });

    // Crear formulario Inscripción
    this.inscripcionForm = this.fb.group({
      visible: [true],
      titulo: ['', Validators.required],
      botonTexto: ['', Validators.required],
      botonLink: ['', Validators.required],
      videoYoutube: [''],
      videoTitulo: ['']
    });

    // Crear formulario Footer
    this.footerForm = this.fb.group({
      visible: [true],
      textoCopyright: ['', Validators.required],
      anioCopyright: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
      whatsappVisible: [true],
      whatsappTexto: ['', Validators.required],
      whatsappNumero: ['', Validators.required],
      whatsappMensaje: [''],
      redesSociales: this.fb.group({
        facebook: this.fb.group({
          url: [''],
          visible: [false]
        }),
        instagram: this.fb.group({
          url: [''],
          visible: [false]
        }),
        twitter: this.fb.group({
          url: [''],
          visible: [false]
        }),
        youtube: this.fb.group({
          url: [''],
          visible: [false]
        }),
        linkedin: this.fb.group({
          url: [''],
          visible: [false]
        })
      })
    });

    // Cargar configuración actual
    await this.cargarConfiguracion();

    // Cargar profesores desde Firestore
    await this.cargarProfesores();
  }

  async cargarConfiguracion() {
    try {
      this.loading = true;
      this.config = await this.homeConfigService.getConfiguracion();

      console.log('📦 Configuración cargada desde Firestore:', this.config);
      console.log('📚 Sección Cursos:', this.config?.seccionCursos);
      console.log('🎯 Cantidad de cursos:', this.config?.seccionCursos?.cursos?.length);

      // Poblar formulario Hero con valores actuales
      if (this.config) {
        this.heroForm.patchValue({
          subtitulo1: this.config.hero.subtitulo1,
          subtitulo2: this.config.hero.subtitulo2,
          titulo: this.config.hero.titulo,
          botonTexto: this.config.hero.botonTexto,
          botonLink: this.config.hero.botonLink
        });

        // Poblar formulario Cursos si existe
        if (this.config.seccionCursos) {
          this.cursosForm.patchValue({
            visible: this.config.seccionCursos.visible,
            titulo: this.config.seccionCursos.titulo,
            subtitulo: this.config.seccionCursos.subtitulo
          });

          // Limpiar y repoblar array de cursos
          this.cursos.clear();
          this.config.seccionCursos.cursos.forEach(curso => {
            this.cursos.push(this.crearCursoForm(curso));
          });
        } else {
          // Si no hay seccionCursos en Firestore, cargar datos por defecto
          this.cursosForm.patchValue({
            visible: CONFIG_HOME_DEFAULT.seccionCursos!.visible,
            titulo: CONFIG_HOME_DEFAULT.seccionCursos!.titulo,
            subtitulo: CONFIG_HOME_DEFAULT.seccionCursos!.subtitulo
          });

          // Limpiar y cargar cursos por defecto
          this.cursos.clear();
          CONFIG_HOME_DEFAULT.seccionCursos!.cursos.forEach(curso => {
            this.cursos.push(this.crearCursoForm(curso));
          });
        }

        // Poblar formulario Portfolio si existe
        if (this.config.seccionPortfolio) {
          this.portfolioForm.patchValue({
            visible: this.config.seccionPortfolio.visible,
            titulo: this.config.seccionPortfolio.titulo,
            subtitulo: this.config.seccionPortfolio.subtitulo
          });

          // Limpiar y repoblar array de materias
          this.materias.clear();
          this.config.seccionPortfolio.materias.forEach(materia => {
            this.materias.push(this.crearMateriaPortfolioForm(materia));
          });
        } else {
          // Si no hay seccionPortfolio en Firestore, cargar datos por defecto
          this.portfolioForm.patchValue({
            visible: CONFIG_HOME_DEFAULT.seccionPortfolio!.visible,
            titulo: CONFIG_HOME_DEFAULT.seccionPortfolio!.titulo,
            subtitulo: CONFIG_HOME_DEFAULT.seccionPortfolio!.subtitulo
          });

          // Limpiar y cargar materias por defecto
          this.materias.clear();
          CONFIG_HOME_DEFAULT.seccionPortfolio!.materias.forEach(materia => {
            this.materias.push(this.crearMateriaPortfolioForm(materia));
          });
        }

        // Poblar formulario About/Timeline si existe
        if (this.config.seccionAbout) {
          this.aboutForm.patchValue({
            visible: this.config.seccionAbout.visible,
            titulo: this.config.seccionAbout.titulo,
            subtitulo: this.config.seccionAbout.subtitulo,
            itemFinal: this.config.seccionAbout.itemFinal
          });

          // Limpiar y repoblar array de items
          this.timelineItems.clear();
          this.config.seccionAbout.items.forEach(item => {
            this.timelineItems.push(this.crearTimelineItemForm(item));
          });
        } else {
          // Si no hay seccionAbout en Firestore, cargar datos por defecto
          this.aboutForm.patchValue({
            visible: CONFIG_HOME_DEFAULT.seccionAbout!.visible,
            titulo: CONFIG_HOME_DEFAULT.seccionAbout!.titulo,
            subtitulo: CONFIG_HOME_DEFAULT.seccionAbout!.subtitulo,
            itemFinal: CONFIG_HOME_DEFAULT.seccionAbout!.itemFinal
          });

          // Limpiar y cargar items por defecto
          this.timelineItems.clear();
          CONFIG_HOME_DEFAULT.seccionAbout!.items.forEach(item => {
            this.timelineItems.push(this.crearTimelineItemForm(item));
          });
        }

        // Poblar formulario Profesores si existe
        if (this.config.seccionProfesores) {
          this.profesoresForm.patchValue({
            visible: this.config.seccionProfesores.visible,
            titulo: this.config.seccionProfesores.titulo,
            subtitulo: this.config.seccionProfesores.subtitulo,
            descripcionPie: this.config.seccionProfesores.descripcionPie,
            usarProfesoresReales: this.config.seccionProfesores.usarProfesoresReales
          });
        } else {
          // Si no hay seccionProfesores en Firestore, cargar datos por defecto
          this.profesoresForm.patchValue({
            visible: CONFIG_HOME_DEFAULT.seccionProfesores!.visible,
            titulo: CONFIG_HOME_DEFAULT.seccionProfesores!.titulo,
            subtitulo: CONFIG_HOME_DEFAULT.seccionProfesores!.subtitulo,
            descripcionPie: CONFIG_HOME_DEFAULT.seccionProfesores!.descripcionPie,
            usarProfesoresReales: CONFIG_HOME_DEFAULT.seccionProfesores!.usarProfesoresReales
          });
        }

        // Poblar formulario Inscripción si existe
        if (this.config.seccionInscripcion) {
          this.inscripcionForm.patchValue({
            visible: this.config.seccionInscripcion.visible,
            titulo: this.config.seccionInscripcion.titulo,
            subtitulo: this.config.seccionInscripcion.subtitulo,
            descripcion: this.config.seccionInscripcion.descripcion,
            botonTexto: this.config.seccionInscripcion.botonTexto,
            botonLink: this.config.seccionInscripcion.botonLink,
            videoYoutube: this.config.seccionInscripcion.videoYoutube,
            videoTitulo: this.config.seccionInscripcion.videoTitulo
          });
        } else {
          // Si no hay seccionInscripcion en Firestore, cargar datos por defecto
          this.inscripcionForm.patchValue({
            visible: CONFIG_HOME_DEFAULT.seccionInscripcion!.visible,
            titulo: CONFIG_HOME_DEFAULT.seccionInscripcion!.titulo,
            subtitulo: CONFIG_HOME_DEFAULT.seccionInscripcion!.subtitulo,
            descripcion: CONFIG_HOME_DEFAULT.seccionInscripcion!.descripcion,
            botonTexto: CONFIG_HOME_DEFAULT.seccionInscripcion!.botonTexto,
            botonLink: CONFIG_HOME_DEFAULT.seccionInscripcion!.botonLink,
            videoYoutube: CONFIG_HOME_DEFAULT.seccionInscripcion!.videoYoutube,
            videoTitulo: CONFIG_HOME_DEFAULT.seccionInscripcion!.videoTitulo
          });
        }

        // Poblar formulario Footer si existe
        if (this.config.footer) {
          const redesSociales = this.config.footer.redesSociales;
          this.footerForm.patchValue({
            visible: this.config.footer.visible,
            textoCopyright: this.config.footer.textoCopyright,
            anioCopyright: this.config.footer.anioCopyright,
            whatsappVisible: this.config.footer.whatsappVisible,
            whatsappTexto: this.config.footer.whatsappTexto,
            whatsappNumero: this.config.footer.whatsappNumero,
            whatsappMensaje: this.config.footer.whatsappMensaje,
            redesSociales: {
              facebook: {
                url: redesSociales.find(r => r.tipo === 'facebook')?.url || '',
                visible: redesSociales.find(r => r.tipo === 'facebook')?.visible || false
              },
              instagram: {
                url: redesSociales.find(r => r.tipo === 'instagram')?.url || '',
                visible: redesSociales.find(r => r.tipo === 'instagram')?.visible || false
              },
              twitter: {
                url: redesSociales.find(r => r.tipo === 'twitter')?.url || '',
                visible: redesSociales.find(r => r.tipo === 'twitter')?.visible || false
              },
              youtube: {
                url: redesSociales.find(r => r.tipo === 'youtube')?.url || '',
                visible: redesSociales.find(r => r.tipo === 'youtube')?.visible || false
              },
              linkedin: {
                url: redesSociales.find(r => r.tipo === 'linkedin')?.url || '',
                visible: redesSociales.find(r => r.tipo === 'linkedin')?.visible || false
              }
            }
          });
        } else {
          // Si no hay footer en Firestore, cargar datos por defecto
          const redesDefault = CONFIG_HOME_DEFAULT.footer!.redesSociales;
          this.footerForm.patchValue({
            visible: CONFIG_HOME_DEFAULT.footer!.visible,
            textoCopyright: CONFIG_HOME_DEFAULT.footer!.textoCopyright,
            anioCopyright: CONFIG_HOME_DEFAULT.footer!.anioCopyright,
            whatsappVisible: CONFIG_HOME_DEFAULT.footer!.whatsappVisible,
            whatsappTexto: CONFIG_HOME_DEFAULT.footer!.whatsappTexto,
            whatsappNumero: CONFIG_HOME_DEFAULT.footer!.whatsappNumero,
            whatsappMensaje: CONFIG_HOME_DEFAULT.footer!.whatsappMensaje,
            redesSociales: {
              facebook: {
                url: redesDefault.find(r => r.tipo === 'facebook')?.url || '',
                visible: redesDefault.find(r => r.tipo === 'facebook')?.visible || false
              },
              instagram: {
                url: redesDefault.find(r => r.tipo === 'instagram')?.url || '',
                visible: redesDefault.find(r => r.tipo === 'instagram')?.visible || false
              },
              twitter: {
                url: redesDefault.find(r => r.tipo === 'twitter')?.url || '',
                visible: redesDefault.find(r => r.tipo === 'twitter')?.visible || false
              },
              youtube: {
                url: redesDefault.find(r => r.tipo === 'youtube')?.url || '',
                visible: redesDefault.find(r => r.tipo === 'youtube')?.visible || false
              },
              linkedin: {
                url: redesDefault.find(r => r.tipo === 'linkedin')?.url || '',
                visible: redesDefault.find(r => r.tipo === 'linkedin')?.visible || false
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
      this.mostrarMensaje('error', 'Error al cargar la configuración del home');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Carga los profesores desde la colección users (rol: profesor/docente)
   */
  async cargarProfesores() {
    try {
      this.loadingProfesores = true;
      this.profesoresReales = await this.homeConfigService.getProfesores();
    } catch (error) {
      console.error('Error cargando profesores:', error);
      this.mostrarMensaje('error', 'Error al cargar profesores desde Firestore');
    } finally {
      this.loadingProfesores = false;
    }
  }

  // ===== HELPERS PARA FORM ARRAYS =====

  get cursos(): FormArray {
    return this.cursosForm.get('cursos') as FormArray;
  }

  crearCursoForm(curso?: any): FormGroup {
    const cursoGroup = this.fb.group({
      titulo: [curso?.titulo || '', Validators.required], // ⚠️ REQUERIDO
      subtitulo: [curso?.subtitulo || ''], // Opcional
      icono: [curso?.icono || 'fa-book', Validators.required], // ⚠️ REQUERIDO
      descripcion: [curso?.descripcion || ''], // Opcional
      materias: this.fb.array([])
    });

    // Agregar materias si existen
    if (curso?.materias) {
      const materiasArray = cursoGroup.get('materias') as FormArray;
      curso.materias.forEach((materia: any) => {
        materiasArray.push(this.crearMateriaForm(materia));
      });
    }

    return cursoGroup;
  }

  crearMateriaForm(materia?: any): FormGroup {
    return this.fb.group({
      nombre: [materia?.nombre || '', Validators.required], // ⚠️ REQUERIDO
      estado: [materia?.estado || null] // Opcional
    });
  }

  getMaterias(cursoIndex: number): FormArray {
    return this.cursos.at(cursoIndex).get('materias') as FormArray;
  }

  // Portfolio/Materias helpers
  get materias(): FormArray {
    return this.portfolioForm.get('materias') as FormArray;
  }

  // About/Timeline helpers
  get timelineItems(): FormArray {
    return this.aboutForm.get('items') as FormArray;
  }

  crearMateriaPortfolioForm(materia?: any): FormGroup {
    return this.fb.group({
      titulo: [materia?.titulo || '', Validators.required], // ⚠️ REQUERIDO
      subtitulo: [materia?.subtitulo || ''], // Opcional
      imagen: [materia?.imagen || ''], // Opcional
      estado: [materia?.estado || null],
      modal: this.fb.group({
        tituloModal: [materia?.modal?.tituloModal || ''], // Opcional (usa título principal si está vacío)
        intro: [materia?.modal?.intro || ''], // Opcional
        imagenModal: [materia?.modal?.imagenModal || ''], // Opcional (usa imagen principal si está vacía)
        descripcion: [materia?.modal?.descripcion || ''], // Opcional
        fechaInicio: [materia?.modal?.fechaInicio || ''], // Opcional
        profesor: [materia?.modal?.profesor || ''] // Opcional
      })
    });
  }

  agregarCurso() {
    this.cursos.push(this.crearCursoForm());
  }

  eliminarCurso(index: number) {
    if (confirm('¿Eliminar este curso?')) {
      this.cursos.removeAt(index);
    }
  }

  agregarMateria(cursoIndex: number) {
    this.getMaterias(cursoIndex).push(this.crearMateriaForm());
  }

  eliminarMateria(cursoIndex: number, materiaIndex: number) {
    this.getMaterias(cursoIndex).removeAt(materiaIndex);
  }

  // Portfolio CRUD
  agregarMateriaPortfolio() {
    this.materias.push(this.crearMateriaPortfolioForm());
  }

  eliminarMateriaPortfolio(index: number) {
    if (confirm('¿Eliminar esta materia del portfolio?')) {
      this.materias.removeAt(index);
    }
  }

  crearTimelineItemForm(item?: any): FormGroup {
    return this.fb.group({
      titulo: [item?.titulo || '', Validators.required], // ⚠️ REQUERIDO
      subtitulo: [item?.subtitulo || ''], // Opcional
      descripcion: [item?.descripcion || ''], // Opcional
      imagen: [item?.imagen || ''], // Opcional
      invertido: [item?.invertido || false]
    });
  }

  // About/Timeline CRUD
  agregarTimelineItem() {
    this.timelineItems.push(this.crearTimelineItemForm());
  }

  eliminarTimelineItem(index: number) {
    if (confirm('¿Eliminar este item del timeline?')) {
      this.timelineItems.removeAt(index);
    }
  }

  // ===== SUBIDA DE IMAGEN =====

  async onImagenFondoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Validar que sea imagen
    if (!file.type.startsWith('image/')) {
      this.mostrarMensaje('error', 'Por favor selecciona un archivo de imagen');
      return;
    }

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.mostrarMensaje('error', 'La imagen no debe superar los 5MB');
      return;
    }

    try {
      this.uploadingImage = true;
      this.mostrarMensaje('info', 'Subiendo imagen...');

      const imageUrl = await this.cloudinaryService.uploadImage(file);

      // Actualizar config local
      if (this.config) {
        this.config.hero.imagenFondo = imageUrl;
      }

      this.mostrarMensaje('success', 'Imagen subida exitosamente. Guarda los cambios para aplicar.');
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      this.mostrarMensaje('error', 'Error al subir la imagen. Intenta nuevamente.');
    } finally {
      this.uploadingImage = false;
    }
  }

  eliminarImagenFondo() {
    if (confirm('¿Eliminar la imagen de fondo? Se usará la imagen por defecto.')) {
      if (this.config) {
        this.config.hero.imagenFondo = undefined;
      }
      this.mostrarMensaje('info', 'Imagen eliminada. Guarda los cambios para aplicar.');
    }
  }

  // ===== GUARDAR CAMBIOS =====

  async guardarCambios() {
    if (this.heroForm.invalid) {
      this.mostrarMensaje('error', 'Por favor completa todos los campos requeridos');
      return;
    }

    if (!this.currentUserId) {
      this.mostrarMensaje('error', 'No se pudo identificar al usuario');
      return;
    }

    try {
      this.saving = true;

      const heroConfig: any = {
        subtitulo1: this.heroForm.value.subtitulo1,
        subtitulo2: this.heroForm.value.subtitulo2,
        titulo: this.heroForm.value.titulo,
        botonTexto: this.heroForm.value.botonTexto,
        botonLink: this.heroForm.value.botonLink
      };

      // Solo incluir imagenFondo si existe (evitar undefined en Firestore)
      if (this.config?.hero?.imagenFondo) {
        heroConfig.imagenFondo = this.config.hero.imagenFondo;
      }

      await this.homeConfigService.updateHero(heroConfig, this.currentUserId);

      this.mostrarMensaje('success', '✅ Cambios guardados exitosamente. El home se actualizará automáticamente.');

      // Recargar configuración
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error guardando cambios:', error);
      this.mostrarMensaje('error', 'Error al guardar los cambios. Intenta nuevamente.');
    } finally {
      this.saving = false;
    }
  }

  async guardarCambiosCursos() {
    if (this.cursosForm.invalid) {
      // Marcar todos los campos como touched para mostrar errores
      this.markFormGroupTouched(this.cursosForm);

      this.mostrarMensaje('error', '❌ Por favor completa los campos requeridos marcados en rojo');
      return;
    }

    if (!this.currentUserId) {
      this.mostrarMensaje('error', 'No se pudo identificar al usuario');
      return;
    }

    try {
      this.saving = true;

      const cursosConfig = this.cursosForm.value;

      await this.homeConfigService.updateSeccionCursos(cursosConfig, this.currentUserId);

      this.mostrarMensaje('success', '✅ Sección Cursos actualizada exitosamente.');

      // Recargar configuración
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error guardando cambios de cursos:', error);
      this.mostrarMensaje('error', 'Error al guardar los cambios de cursos.');
    } finally {
      this.saving = false;
    }
  }

  async guardarCambiosPortfolio() {
    if (this.portfolioForm.invalid) {
      // Marcar todos los campos como touched para mostrar errores
      this.markFormGroupTouched(this.portfolioForm);

      this.mostrarMensaje('error', '❌ Por favor completa los campos requeridos marcados en rojo');
      return;
    }

    if (!this.currentUserId) {
      this.mostrarMensaje('error', 'No se pudo identificar al usuario');
      return;
    }

    try {
      this.saving = true;

      const portfolioConfig = this.portfolioForm.value;

      await this.homeConfigService.updateSeccionPortfolio(portfolioConfig, this.currentUserId);

      this.mostrarMensaje('success', '✅ Sección Portfolio/Materias actualizada exitosamente.');

      // Recargar configuración
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error guardando cambios de portfolio:', error);
      this.mostrarMensaje('error', 'Error al guardar los cambios de portfolio.');
    } finally {
      this.saving = false;
    }
  }

  async guardarCambiosAbout() {
    if (this.aboutForm.invalid) {
      // Marcar todos los campos como touched para mostrar errores
      this.markFormGroupTouched(this.aboutForm);

      this.mostrarMensaje('error', '❌ Por favor completa los campos requeridos marcados en rojo');
      return;
    }

    if (!this.currentUserId) {
      this.mostrarMensaje('error', 'No se pudo identificar al usuario');
      return;
    }

    try {
      this.saving = true;

      const aboutConfig = this.aboutForm.value;

      await this.homeConfigService.updateSeccionAbout(aboutConfig, this.currentUserId);

      this.mostrarMensaje('success', '✅ Sección About/Timeline actualizada exitosamente.');

      // Recargar configuración
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error guardando cambios de about:', error);
      this.mostrarMensaje('error', 'Error al guardar los cambios de about.');
    } finally {
      this.saving = false;
    }
  }

  // Subir imagen de materia Portfolio
  async onImagenMateriaSelected(event: Event, materiaIndex: number) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    try {
      this.uploadingImage = true;
      const imageUrl = await this.cloudinaryService.uploadImage(file);
      this.materias.at(materiaIndex).get('imagen')?.setValue(imageUrl);

      this.mostrarMensaje('success', '✅ Imagen cargada exitosamente');
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      alert('Error al subir la imagen. Intenta nuevamente.');
    } finally {
      this.uploadingImage = false;
      input.value = '';
    }
  }

  // Subir imagen modal de materia Portfolio
  async onImagenModalMateriaSelected(event: Event, materiaIndex: number) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    try {
      this.uploadingImage = true;
      const imageUrl = await this.cloudinaryService.uploadImage(file);
      this.materias.at(materiaIndex).get('modal')?.get('imagenModal')?.setValue(imageUrl);

      this.mostrarMensaje('success', '✅ Imagen modal cargada exitosamente');
    } catch (error) {
      console.error('Error subiendo imagen modal:', error);
      alert('Error al subir la imagen modal. Intenta nuevamente.');
    } finally {
      this.uploadingImage = false;
      input.value = '';
    }
  }

  async onImagenTimelineSelected(event: any, itemIndex: number) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    try {
      this.uploadingImage = true;
      const imageUrl = await this.cloudinaryService.uploadImage(file);
      this.timelineItems.at(itemIndex).get('imagen')?.setValue(imageUrl);

      this.mostrarMensaje('success', '✅ Imagen timeline cargada exitosamente');
    } catch (error) {
      console.error('Error subiendo imagen timeline:', error);
      alert('Error al subir la imagen timeline. Intenta nuevamente.');
    } finally {
      this.uploadingImage = false;
      input.value = '';
    }
  }

  cambiarTab(tab: 'hero' | 'cursos' | 'portfolio' | 'about' | 'profesores' | 'inscripcion' | 'footer') {
    this.tabActiva = tab;
  }

  cargarValoresPorDefecto(seccion: 'hero' | 'cursos' | 'portfolio' | 'about' | 'profesores' | 'inscripcion' | 'footer') {
    if (!confirm('¿Cargar valores por defecto en el formulario? (No se guardará hasta que presiones "Guardar Cambios")')) {
      return;
    }

    switch (seccion) {
      case 'hero':
        this.heroForm.patchValue({
          titulo: CONFIG_HOME_DEFAULT.hero.titulo,
          subtitulo1: CONFIG_HOME_DEFAULT.hero.subtitulo1,
          subtitulo2: CONFIG_HOME_DEFAULT.hero.subtitulo2,
          botonTexto: CONFIG_HOME_DEFAULT.hero.botonTexto,
          botonLink: CONFIG_HOME_DEFAULT.hero.botonLink,
          imagenFondo: CONFIG_HOME_DEFAULT.hero.imagenFondo
        });
        this.mostrarMensaje('info', 'Valores por defecto cargados en Hero');
        break;

      case 'cursos':
        this.cursosForm.patchValue({
          visible: CONFIG_HOME_DEFAULT.seccionCursos!.visible,
          titulo: CONFIG_HOME_DEFAULT.seccionCursos!.titulo,
          subtitulo: CONFIG_HOME_DEFAULT.seccionCursos!.subtitulo
        });
        this.cursos.clear();
        CONFIG_HOME_DEFAULT.seccionCursos!.cursos.forEach(curso => {
          this.cursos.push(this.crearCursoForm(curso));
        });
        this.mostrarMensaje('info', 'Valores por defecto cargados en Cursos');
        break;

      case 'portfolio':
        this.portfolioForm.patchValue({
          visible: CONFIG_HOME_DEFAULT.seccionPortfolio!.visible,
          titulo: CONFIG_HOME_DEFAULT.seccionPortfolio!.titulo,
          subtitulo: CONFIG_HOME_DEFAULT.seccionPortfolio!.subtitulo
        });
        this.materias.clear();
        CONFIG_HOME_DEFAULT.seccionPortfolio!.materias.forEach(materia => {
          this.materias.push(this.crearMateriaPortfolioForm(materia));
        });
        this.mostrarMensaje('info', 'Valores por defecto cargados en Portfolio');
        break;

      case 'about':
        this.aboutForm.patchValue({
          visible: CONFIG_HOME_DEFAULT.seccionAbout!.visible,
          titulo: CONFIG_HOME_DEFAULT.seccionAbout!.titulo,
          subtitulo: CONFIG_HOME_DEFAULT.seccionAbout!.subtitulo,
          itemFinal: CONFIG_HOME_DEFAULT.seccionAbout!.itemFinal
        });
        this.timelineItems.clear();
        CONFIG_HOME_DEFAULT.seccionAbout!.items.forEach(item => {
          this.timelineItems.push(this.crearTimelineItemForm(item));
        });
        this.mostrarMensaje('info', 'Valores por defecto cargados en About/Timeline');
        break;

      case 'profesores':
        this.profesoresForm.patchValue({
          visible: CONFIG_HOME_DEFAULT.seccionProfesores!.visible,
          titulo: CONFIG_HOME_DEFAULT.seccionProfesores!.titulo,
          subtitulo: CONFIG_HOME_DEFAULT.seccionProfesores!.subtitulo,
          descripcionPie: CONFIG_HOME_DEFAULT.seccionProfesores!.descripcionPie,
          usarProfesoresReales: CONFIG_HOME_DEFAULT.seccionProfesores!.usarProfesoresReales
        });
        this.mostrarMensaje('info', 'Valores por defecto cargados en Profesores');
        break;

      case 'inscripcion':
        this.inscripcionForm.patchValue({
          visible: CONFIG_HOME_DEFAULT.seccionInscripcion!.visible,
          titulo: CONFIG_HOME_DEFAULT.seccionInscripcion!.titulo,
          subtitulo: CONFIG_HOME_DEFAULT.seccionInscripcion!.subtitulo,
          descripcion: CONFIG_HOME_DEFAULT.seccionInscripcion!.descripcion,
          botonTexto: CONFIG_HOME_DEFAULT.seccionInscripcion!.botonTexto,
          botonLink: CONFIG_HOME_DEFAULT.seccionInscripcion!.botonLink,
          videoYoutube: CONFIG_HOME_DEFAULT.seccionInscripcion!.videoYoutube,
          videoTitulo: CONFIG_HOME_DEFAULT.seccionInscripcion!.videoTitulo
        });
        this.mostrarMensaje('info', 'Valores por defecto cargados en Inscripción');
        break;

      case 'footer':
        const redesDefault = CONFIG_HOME_DEFAULT.footer!.redesSociales;
        this.footerForm.patchValue({
          visible: CONFIG_HOME_DEFAULT.footer!.visible,
          textoCopyright: CONFIG_HOME_DEFAULT.footer!.textoCopyright,
          anioCopyright: CONFIG_HOME_DEFAULT.footer!.anioCopyright,
          whatsappVisible: CONFIG_HOME_DEFAULT.footer!.whatsappVisible,
          whatsappTexto: CONFIG_HOME_DEFAULT.footer!.whatsappTexto,
          whatsappNumero: CONFIG_HOME_DEFAULT.footer!.whatsappNumero,
          whatsappMensaje: CONFIG_HOME_DEFAULT.footer!.whatsappMensaje,
          redesSociales: {
            facebook: {
              url: redesDefault.find(r => r.tipo === 'facebook')?.url || '',
              visible: redesDefault.find(r => r.tipo === 'facebook')?.visible || false
            },
            instagram: {
              url: redesDefault.find(r => r.tipo === 'instagram')?.url || '',
              visible: redesDefault.find(r => r.tipo === 'instagram')?.visible || false
            },
            twitter: {
              url: redesDefault.find(r => r.tipo === 'twitter')?.url || '',
              visible: redesDefault.find(r => r.tipo === 'twitter')?.visible || false
            },
            youtube: {
              url: redesDefault.find(r => r.tipo === 'youtube')?.url || '',
              visible: redesDefault.find(r => r.tipo === 'youtube')?.visible || false
            },
            linkedin: {
              url: redesDefault.find(r => r.tipo === 'linkedin')?.url || '',
              visible: redesDefault.find(r => r.tipo === 'linkedin')?.visible || false
            }
          }
        });
        this.mostrarMensaje('info', 'Valores por defecto cargados en Footer');
        break;
    }
  }

  /**
   * Guarda los cambios de la sección Profesores
   */
  async guardarCambiosProfesores() {
    if (this.profesoresForm.invalid) {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    try {
      this.saving = true;
      const formData = this.profesoresForm.value;

      await this.homeConfigService.updateSeccionProfesores({
        visible: formData.visible,
        titulo: formData.titulo,
        subtitulo: formData.subtitulo,
        descripcionPie: formData.descripcionPie,
        usarProfesoresReales: formData.usarProfesoresReales
      }, this.currentUserId);

      this.mostrarMensaje('success', '✅ Configuración de Profesores guardada exitosamente');

      // Recargar config para reflejar cambios
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error guardando configuración de profesores:', error);
      alert('Error al guardar la configuración de profesores. Intenta nuevamente.');
    } finally {
      this.saving = false;
    }
  }

  async guardarCambiosInscripcion() {
    if (this.inscripcionForm.invalid) {
      this.mostrarMensaje('error', 'Por favor completa todos los campos requeridos');
      return;
    }

    try {
      this.saving = true;
      const datos = this.inscripcionForm.value;

      await this.homeConfigService.updateSeccionInscripcion(datos, this.currentUserId);
      this.mostrarMensaje('success', 'Sección Inscripción guardada correctamente');
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error guardando sección inscripción:', error);
      this.mostrarMensaje('error', 'Error al guardar la sección de inscripción');
    } finally {
      this.saving = false;
    }
  }

  async guardarCambiosFooter() {
    if (this.footerForm.invalid) {
      this.mostrarMensaje('error', 'Por favor completa todos los campos requeridos');
      return;
    }

    try {
      this.saving = true;
      const formValue = this.footerForm.value;

      // Convertir formato del formulario a formato del modelo
      const footerConfig = {
        visible: formValue.visible,
        textoCopyright: formValue.textoCopyright,
        anioCopyright: formValue.anioCopyright,
        whatsappVisible: formValue.whatsappVisible,
        whatsappTexto: formValue.whatsappTexto,
        whatsappNumero: formValue.whatsappNumero,
        whatsappMensaje: formValue.whatsappMensaje,
        redesSociales: [
          { tipo: 'facebook' as const, url: formValue.redesSociales.facebook.url, visible: formValue.redesSociales.facebook.visible },
          { tipo: 'instagram' as const, url: formValue.redesSociales.instagram.url, visible: formValue.redesSociales.instagram.visible },
          { tipo: 'twitter' as const, url: formValue.redesSociales.twitter.url, visible: formValue.redesSociales.twitter.visible },
          { tipo: 'youtube' as const, url: formValue.redesSociales.youtube.url, visible: formValue.redesSociales.youtube.visible },
          { tipo: 'linkedin' as const, url: formValue.redesSociales.linkedin.url, visible: formValue.redesSociales.linkedin.visible }
        ]
      };

      await this.homeConfigService.updateSeccionFooter(footerConfig, this.currentUserId);
      this.mostrarMensaje('success', 'Sección Footer guardada correctamente');
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error guardando sección footer:', error);
      this.mostrarMensaje('error', 'Error al guardar la sección del footer');
    } finally {
      this.saving = false;
    }
  }

  async resetearValores() {
    if (!confirm('¿Estás seguro de restablecer los valores por defecto? Esto sobrescribirá todos los cambios.')) {
      return;
    }

    try {
      this.saving = true;
      await this.homeConfigService.resetToDefault(this.currentUserId);
      this.mostrarMensaje('info', 'Valores restablecidos a los originales');
      await this.cargarConfiguracion();
    } catch (error) {
      console.error('Error reseteando valores:', error);
      this.mostrarMensaje('error', 'Error al restablecer valores');
    } finally {
      this.saving = false;
    }
  }

  verVistaPrevia() {
    // Abrir home en nueva pestaña
    window.open('/home', '_blank');
  }

  private mostrarMensaje(tipo: 'success' | 'error' | 'info', texto: string) {
    this.mensaje = { tipo, texto };

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
      this.mensaje = null;
    }, 5000);
  }

  volverAdmin() {
    this.router.navigate(['/admin']);
  }

  // ===== MÉTODOS AUXILIARES DE VALIDACIÓN =====

  /**
   * Marca todos los campos de un FormGroup/FormArray como touched
   * para mostrar mensajes de validación
   */
  markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
