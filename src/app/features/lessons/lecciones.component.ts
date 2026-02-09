import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { LessonService } from '../../core/services/lesson.service';
import { SectionService } from '../../core/services/section.service';
import { AuthService } from '../../core/services/auth.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { Leccion } from '../../core/models/lesson.model';
import { Seccion } from '../../core/models/section.model';
import { marked } from 'marked';

@Component({
  selector: 'app-lecciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './lecciones.component.html',
  styleUrl: './lecciones.component.scss'
})
export class LeccionesComponent implements OnInit {
  seccion: Seccion | null = null;
  lecciones: Leccion[] = [];
  loading = true;

  // Modales
  showCreateModal = false;
  showEditModal = false;
  showViewModal = false;
  selectedLesson: Leccion | null = null;

  // Nueva lección
  newLesson = {
    titulo: '',
    tipo: 'texto' as 'texto' | 'imagen' | 'pdf' | 'video',
    contenido: '',
    urlArchivo: '',
    urlYoutube: '',
    preguntaTexto: '',
    opcionCorrecta: '',
    opcionIncorrecta: ''
  };

  // Subida de archivos
  uploadingFile = false;
  fileProgress = 0;

  // Markdown
  showPreview = false;
  showPreviewEdit = false;
  @ViewChild('markdownTextarea') markdownTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('markdownTextareaEdit') markdownTextareaEdit?: ElementRef<HTMLTextAreaElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private lessonService: LessonService,
    private sectionService: SectionService,
    private authService: AuthService,
    private cloudinaryService: CloudinaryService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    const seccionId = this.route.snapshot.paramMap.get('seccionId');
    if (seccionId) {
      this.loadSeccion(seccionId);
      this.loadLecciones(seccionId);
    }
  }

  async loadSeccion(seccionId: string) {
    try {
      this.seccion = await this.sectionService.getSectionById(seccionId);
    } catch (error) {
      console.error('Error cargando sección:', error);
    }
  }

  loadLecciones(seccionId: string) {
    this.loading = true;
    this.lessonService.getLessonsBySection(seccionId).subscribe({
      next: (lecciones) => {
        this.lecciones = lecciones;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando lecciones:', error);
        this.loading = false;
      }
    });
  }

  openCreateModal() {
    this.newLesson = {
      titulo: '',
      tipo: 'texto',
      contenido: '',
      urlArchivo: '',
      urlYoutube: '',
      preguntaTexto: '',
      opcionCorrecta: '',
      opcionIncorrecta: ''
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  async createLesson() {
    if (!this.seccion || !this.newLesson.titulo) {
      alert('Por favor completa el título de la lección');
      return;
    }

    try {
      const lessonData: any = {
        seccionId: this.seccion.id,
        titulo: this.newLesson.titulo,
        tipo: this.newLesson.tipo,
        contenido: this.newLesson.contenido || '',
        orden: this.lecciones.length
      };

      // Solo agregar campos opcionales si tienen valor
      if (this.newLesson.tipo === 'imagen' || this.newLesson.tipo === 'pdf') {
        if (this.newLesson.urlArchivo) {
          lessonData.urlArchivo = this.newLesson.urlArchivo;
        }
      } else if (this.newLesson.tipo === 'video') {
        if (this.newLesson.urlYoutube) {
          lessonData.urlYoutube = this.newLesson.urlYoutube;
        }
      }

      // Agregar pregunta de retroalimentación si se completó
      if (this.newLesson.preguntaTexto && this.newLesson.opcionCorrecta && this.newLesson.opcionIncorrecta) {
        lessonData.preguntaRetroalimentacion = {
          texto: this.newLesson.preguntaTexto,
          opcionCorrecta: this.newLesson.opcionCorrecta,
          opcionIncorrecta: this.newLesson.opcionIncorrecta
        };
      }

      await this.lessonService.createLesson(lessonData);

      alert('Lección creada exitosamente');
      this.closeCreateModal();
    } catch (error) {
      console.error('Error creando lección:', error);
      alert('Error al crear lección');
    }
  }

  editLesson(lesson: Leccion) {
    this.selectedLesson = { ...lesson };
    // Inicializar preguntaRetroalimentacion si no existe
    if (!this.selectedLesson.preguntaRetroalimentacion) {
      this.selectedLesson.preguntaRetroalimentacion = {
        texto: '',
        opcionCorrecta: '',
        opcionIncorrecta: ''
      };
    }
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedLesson = null;
  }

  async saveLesson() {
    if (!this.selectedLesson) return;

    try {
      const updateData: any = {
        titulo: this.selectedLesson.titulo,
        contenido: this.selectedLesson.contenido || ''
      };

      // Solo agregar campos opcionales si tienen valor
      if (this.selectedLesson.tipo === 'imagen' || this.selectedLesson.tipo === 'pdf') {
        if (this.selectedLesson.urlArchivo) {
          updateData.urlArchivo = this.selectedLesson.urlArchivo;
        }
      } else if (this.selectedLesson.tipo === 'video') {
        if (this.selectedLesson.urlYoutube) {
          updateData.urlYoutube = this.selectedLesson.urlYoutube;
        }
      }

      // Actualizar o eliminar pregunta de retroalimentación
      if (this.selectedLesson.preguntaRetroalimentacion?.texto &&
          this.selectedLesson.preguntaRetroalimentacion?.opcionCorrecta &&
          this.selectedLesson.preguntaRetroalimentacion?.opcionIncorrecta) {
        updateData.preguntaRetroalimentacion = {
          texto: this.selectedLesson.preguntaRetroalimentacion.texto,
          opcionCorrecta: this.selectedLesson.preguntaRetroalimentacion.opcionCorrecta,
          opcionIncorrecta: this.selectedLesson.preguntaRetroalimentacion.opcionIncorrecta
        };
      } else {
        // Si están vacíos, eliminar la pregunta
        updateData.preguntaRetroalimentacion = null;
      }

      await this.lessonService.updateLesson(this.selectedLesson.id, updateData);

      alert('Lección actualizada correctamente');
      this.closeEditModal();
    } catch (error) {
      console.error('Error actualizando lección:', error);
      alert('Error al actualizar lección');
    }
  }

  async deleteLesson(lesson: Leccion) {
    if (confirm(`¿Está seguro de eliminar la lección "${lesson.titulo}"?`)) {
      try {
        await this.lessonService.deleteLesson(lesson.id);
        alert('Lección eliminada correctamente');
      } catch (error) {
        console.error('Error eliminando lección:', error);
        alert('Error al eliminar lección');
      }
    }
  }

  viewLesson(lesson: Leccion) {
    this.selectedLesson = lesson;
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedLesson = null;
  }

  // Método para subir archivos (imagen o PDF)
  async onFileSelected(event: any, isEdit: boolean = false) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const lesson = isEdit ? this.selectedLesson : this.newLesson;
    if (!lesson) return;

    if (lesson.tipo === 'imagen' && !file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido');
      return;
    }

    if (lesson.tipo === 'pdf' && file.type !== 'application/pdf') {
      alert('Por favor selecciona un archivo PDF válido');
      return;
    }

    try {
      this.uploadingFile = true;
      this.fileProgress = 0;

      const uploadPreset = lesson.tipo === 'imagen' ? 'userProfile' : 'userProfile'; // Usar el mismo preset
      const result = await this.cloudinaryService.uploadFile(file, uploadPreset);

      if (isEdit && this.selectedLesson) {
        this.selectedLesson.urlArchivo = result.secure_url;
      } else {
        this.newLesson.urlArchivo = result.secure_url;
      }

      this.uploadingFile = false;
      this.fileProgress = 100;
      alert('Archivo subido exitosamente');
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      alert('Error al subir archivo');
      this.uploadingFile = false;
      this.fileProgress = 0;
    }
  }

  getTipoIcon(tipo: string): string {
    switch (tipo) {
      case 'texto':
        return 'fa-file-alt';
      case 'imagen':
        return 'fa-image';
      case 'pdf':
        return 'fa-file-pdf';
      case 'video':
        return 'fa-video';
      default:
        return 'fa-file';
    }
  }

  getTipoBadgeClass(tipo: string): string {
    switch (tipo) {
      case 'texto':
        return 'bg-primary';
      case 'imagen':
        return 'bg-success';
      case 'pdf':
        return 'bg-danger';
      case 'video':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }

  getYoutubeEmbedUrl(url: string): SafeResourceUrl {
    // Convertir URL de YouTube a formato embed
    const videoId = this.extractYoutubeVideoId(url);
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  getSafePdfUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  private extractYoutubeVideoId(url: string): string | null {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  }

  goToDashboard() {
    this.authService.getCurrentUserProfile().then(currentUser => {
      if (currentUser) {
        const userRole = currentUser.rol;
        if (userRole === 'admin') {
          this.router.navigate(['/admin']);
        } else if (userRole === 'profesor') {
          this.router.navigate(['/profesor']);
        } else if (userRole === 'estudiante') {
          this.router.navigate(['/estudiante']);
        }
      }
    });
  }

  goToTasks(leccionId: string) {
    this.router.navigate(['/lecciones', leccionId, 'tareas']);
  }

  goBack() {
    if (this.seccion) {
      this.router.navigate(['/cursos', this.seccion.cursoId, 'secciones']);
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  // ===== MARKDOWN EDITOR METHODS =====

  /**
   * Insertar sintaxis Markdown en el textarea de creación
   */
  insertMarkdown(before: string, after: string, placeholder: string) {
    const textarea = this.markdownTextarea?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.newLesson.contenido.substring(start, end);
    const textToInsert = selectedText || placeholder;

    const newText =
      this.newLesson.contenido.substring(0, start) +
      before + textToInsert + after +
      this.newLesson.contenido.substring(end);

    this.newLesson.contenido = newText;

    // Restaurar focus y selección
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + textToInsert.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }

  /**
   * Insertar sintaxis Markdown en el textarea de edición
   */
  insertMarkdownEdit(before: string, after: string, placeholder: string) {
    const textarea = this.markdownTextareaEdit?.nativeElement;
    if (!textarea || !this.selectedLesson) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.selectedLesson.contenido.substring(start, end);
    const textToInsert = selectedText || placeholder;

    const newText =
      this.selectedLesson.contenido.substring(0, start) +
      before + textToInsert + after +
      this.selectedLesson.contenido.substring(end);

    this.selectedLesson.contenido = newText;

    // Restaurar focus y selección
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + textToInsert.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }

  /**
   * Toggle vista previa en modal de creación
   */
  togglePreview() {
    this.showPreview = !this.showPreview;
  }

  /**
   * Toggle vista previa en modal de edición
   */
  togglePreviewEdit() {
    this.showPreviewEdit = !this.showPreviewEdit;
  }

  /**
   * Convertir Markdown a HTML y sanitizar
   */
  getMarkdownPreview(markdown: string): SafeHtml {
    if (!markdown) return this.sanitizer.sanitize(1, '') || '';

    // Configurar marked para soportar saltos de línea y listas
    marked.setOptions({
      breaks: true,
      gfm: true
    });

    try {
      const html = marked(markdown);
      return this.sanitizer.sanitize(1, html as string) || '';
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return this.sanitizer.sanitize(1, markdown) || '';
    }
  }
}
