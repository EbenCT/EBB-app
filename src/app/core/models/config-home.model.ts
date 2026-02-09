/**
 * Modelo para la configuración dinámica del Home
 * FASE 0.5 - Hero ✅
 * FASE 1 - Sección Cursos ✅
 * FASE 2 - Sección Portfolio/Materias ✅
 * FASE 3 - Sección About/Timeline ✅
 * FASE 4 - Sección Profesores ⏳
 */

// ===== HERO/MASTHEAD =====
export interface HeroConfig {
  subtitulo1: string; // "¡Desarrolla tu fe!"
  subtitulo2: string; // Horario de clases
  titulo: string; // "ESCUELA BÍBLICA CAVEVID"
  botonTexto: string; // "Ver cursos"
  botonLink: string; // "#services"
  imagenFondo?: string; // Opcional - override CSS
}

// ===== SECCIÓN CURSOS =====
export interface MateriaInfo {
  nombre: string;
  estado?: 'en-curso' | 'proximamente' | 'completado' | null; // Badge opcional
}

export interface CursoInfo {
  titulo: string; // "Básico" o "Avanzado"
  subtitulo: string; // "Estudio Bíblico Fundamental"
  icono: string; // Clase de Font Awesome, ej: "fa-book-reader"
  descripcion: string;
  materias: MateriaInfo[];
}

export interface SeccionCursosConfig {
  visible: boolean;
  titulo: string; // "Cursos"
  subtitulo: string; // "Dos niveles para elegir."
  cursos: CursoInfo[]; // Normalmente 2: Básico y Avanzado
}

// ===== SECCIÓN PORTFOLIO/MATERIAS =====
export interface MateriaDetalle {
  titulo: string; // "Evangelismo Personal"
  subtitulo: string; // "(Curso Básico)"
  imagen: string; // URL de imagen principal
  estado?: 'en-curso' | 'proximamente' | null; // Badge opcional

  // Datos del modal
  modal: {
    tituloModal: string; // Puede ser igual al título o más largo
    intro: string; // Texto pequeño bajo el título del modal
    imagenModal: string; // Imagen mostrada en el modal (puede ser la misma)
    descripcion: string; // Descripción larga HTML
    fechaInicio: string; // "Domingo 01 de Junio"
    profesor: string; // "Marco Sánchez"
  };
}

export interface SeccionPortfolioConfig {
  visible: boolean;
  titulo: string; // "Materias"
  subtitulo: string; // "Más detalles sobre cada materia..."
  materias: MateriaDetalle[]; // Normalmente 10 materias
}

// ===== SECCIÓN ABOUT/TIMELINE =====
export interface TimelineItem {
  titulo: string; // "MISIÓN", "VISIÓN", "OBJETIVO", "COMPROMISO"
  subtitulo: string; // "Formación Integral en la Palabra"
  descripcion: string; // Texto descriptivo
  imagen: string; // URL de imagen circular
  invertido: boolean; // true para alternar posición izq/der
}

export interface SeccionAboutConfig {
  visible: boolean;
  titulo: string; // "Propósito de la Escuela Bíblica"
  subtitulo: string; // "¿Por qué existe este ministerio?"
  items: TimelineItem[]; // Normalmente 4 items
  itemFinal: {
    linea1: string; // "Tu también"
    linea2: string; // "Puedes"
    linea3: string; // "Ser Parte"
  };
}

// ===== SECCIÓN PROFESORES =====
export interface ProfesorInfo {
  uid?: string; // ID del usuario (opcional para hardcodeados)
  nombreCompleto: string;
  nombre?: string; // Alias de nombreCompleto
  email?: string;
  fotoPerfil?: string; // URL de la foto
  foto?: string; // Alias de fotoPerfil
  especialidad?: string; // Materias que enseña
  descripcion?: string; // Alias de especialidad
  redesSociales?: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
}

export interface SeccionProfesoresConfig {
  visible: boolean;
  titulo: string; // "PROFESORES"
  subtitulo: string; // "Equipo de maestros de la Escuela Bíblica"
  textoFooter?: string; // Descripción al final de la sección (alias)
  descripcionPie?: string; // Alias de textoFooter
  usarProfesoresReales?: boolean; // Si true, carga desde users, si false usa hardcodeados
  // Los profesores se cargan dinámicamente desde la colección users (rol: profesor/docente)
  // No se almacenan en la config, solo título/subtítulo/footer
}

// ===== SECCIÓN INSCRIPCIÓN (FASE 5) =====
export interface SeccionInscripcionConfig {
  visible: boolean;
  titulo: string; // "¿Listo para empezar?"
  subtitulo: string; // "Inscríbete ahora en nuestra Escuela Bíblica"
  descripcion: string; // Texto explicativo
  botonTexto: string; // "Inscribirme Ahora"
  botonLink: string; // "/login" o "/registro"
  videoYoutube?: string; // URL del video de YouTube (ej: "https://www.youtube.com/watch?v=xxxxx" o "xxxxx")
  videoTitulo?: string; // "Tutorial: Cómo inscribirse"
}

// ===== SECCIÓN FOOTER (FASE 6) =====
export interface RedSocial {
  tipo: 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'linkedin';
  url: string;
  visible: boolean;
}

export interface SeccionFooterConfig {
  visible: boolean;
  textoCopyright: string; // "Escuela Biblica CAVEVID"
  anioCopyright: number; // 2025
  redesSociales: RedSocial[];
  whatsappVisible: boolean;
  whatsappTexto: string; // "Contacto WhatsApp:"
  whatsappNumero: string; // "+591 63332108"
  whatsappMensaje: string; // "Hola, quiero participar del curso de la Escuela Biblica!"
}

// ===== CONFIGURACIÓN PRINCIPAL =====
export interface ConfiguracionHome {
  id: 'principal';

  // Metadata
  ultimaActualizacion: Date;
  actualizadoPor: string; // ID del admin que hizo el último cambio

  // Hero/Masthead
  hero: HeroConfig;

  // Sección Cursos (FASE 1)
  seccionCursos?: SeccionCursosConfig;

  // Sección Portfolio/Materias (FASE 2)
  seccionPortfolio?: SeccionPortfolioConfig;

  // Sección About/Timeline (FASE 3)
  seccionAbout?: SeccionAboutConfig;

  // Sección Profesores (FASE 4)
  seccionProfesores?: SeccionProfesoresConfig;

  // Sección Inscripción (FASE 5)
  seccionInscripcion?: SeccionInscripcionConfig;

  // Sección Footer (FASE 6)
  footer?: SeccionFooterConfig;
}

// ===== CONFIGURACIÓN POR DEFECTO (Valores actuales del index.html) =====
export const CONFIG_HOME_DEFAULT: Omit<ConfiguracionHome, 'ultimaActualizacion' | 'actualizadoPor'> = {
  id: 'principal',

  hero: {
    subtitulo1: '¡Desarrolla tu fe!',
    subtitulo2: 'CLASES TODOS LOS DOMINGOS A LAS 18:00PM',
    titulo: 'ESCUELA BÍBLICA CAVEVID',
    botonTexto: 'Ver cursos',
    botonLink: '#services'
  },

  seccionCursos: {
    visible: true,
    titulo: 'Cursos',
    subtitulo: 'Dos niveles para elegir.',
    cursos: [
      {
        titulo: 'Básico',
        subtitulo: 'Estudio Bíblico Fundamental',
        icono: 'fa-book-reader',
        descripcion: 'Este curso introduce los principios básicos del estudio de la Biblia. Ideal para quienes desean establecer una base sólida en su camino de fe y servicio cristiano.',
        materias: [
          { nombre: 'Evangelismo Personal', estado: 'en-curso' },
          { nombre: 'Vida Cristiana', estado: null },
          { nombre: 'Síntesis del Antiguo Testamento', estado: null },
          { nombre: 'Síntesis del Nuevo Testamento', estado: null },
          { nombre: 'Servicio Ministerial', estado: null }
        ]
      },
      {
        titulo: 'Avanzado',
        subtitulo: 'Teología y Evangelismo Profesional',
        icono: 'fa-graduation-cap',
        descripcion: 'Este curso profundiza en el estudio avanzado de la Biblia y la teología cristiana. Está diseñado para aquellos que buscan un conocimiento más profundo para ejercer un liderazgo efectivo en la iglesia y en la misión cristiana.',
        materias: [
          { nombre: 'Métodos de Evangelismo General', estado: 'en-curso' },
          { nombre: 'Introducción a la Teología Sistemática', estado: null },
          { nombre: 'Bibliología', estado: null },
          { nombre: 'Homilética', estado: null },
          { nombre: 'Misiología', estado: null }
        ]
      }
    ]
  },

  seccionPortfolio: {
    visible: true,
    titulo: 'Materias',
    subtitulo: 'Mas detalles sobre cada materia empezando por el curso basico hasta el avanzado.',
    materias: [
      {
        titulo: 'Evangelismo Personal',
        subtitulo: '(Curso Basico)',
        imagen: 'assets/img/portfolio/1.png',
        estado: 'en-curso',
        modal: {
          tituloModal: 'Evangelismo Personal',
          intro: 'Compartiendo la Fe de Manera Efectiva.',
          imagenModal: 'assets/img/portfolio/1.png',
          descripcion: 'Este curso está diseñado para equipar a cada creyente con herramientas prácticas para compartir el evangelio de manera efectiva en su entorno cotidiano. Se explorarán principios bíblicos sobre el evangelismo, métodos de acercamiento personal y el uso de recursos para presentar a Cristo de forma clara y persuasiva. A lo largo del curso, los participantes aprenderán a superar el temor al rechazo, a identificar oportunidades para hablar de Jesús y a desarrollar una pasión genuina por la salvación de las almas. Este curso es fundamental para todo cristiano que desee cumplir con la Gran Comisión en su vida diaria.',
          fechaInicio: 'Domingo 02 de Febrero',
          profesor: 'Marco Sanchez'
        }
      },
      {
        titulo: 'Vida Cristiana',
        subtitulo: '(Curso Basico)',
        imagen: 'assets/img/portfolio/2.jpg',
        estado: null,
        modal: {
          tituloModal: 'Vida Cristiana',
          intro: 'Fundamentos para Crecer en la Fe.',
          imagenModal: 'assets/img/portfolio/2.jpg',
          descripcion: 'Este curso aborda los principios básicos de la vida cristiana, ayudando a los nuevos creyentes y a aquellos que desean fortalecer su fe a establecer hábitos espirituales sólidos. Se estudiarán temas como la oración, el estudio de la Biblia, la obediencia a Dios, el testimonio personal y el servicio en la iglesia. También se explorará la importancia de la comunión con Dios y con otros creyentes, así como el papel del Espíritu Santo en la vida diaria. Al finalizar el curso, los participantes estarán mejor equipados para vivir una vida cristiana coherente y fructífera.',
          fechaInicio: 'Domingo 06 de Abril',
          profesor: 'Efrain Villafuerte'
        }
      },
      {
        titulo: 'Sinstesis del Antiguo Testamento',
        subtitulo: '(Curso Basico)',
        imagen: 'assets/img/portfolio/3.jpg',
        estado: null,
        modal: {
          tituloModal: 'Síntesis del Antiguo Testamento',
          intro: 'Una Visión General de la Historia Bíblica.',
          imagenModal: 'assets/img/portfolio/3.jpg',
          descripcion: 'Este curso ofrece una visión panorámica del Antiguo Testamento, ayudando a los participantes a comprender su estructura, mensaje y propósito dentro de la revelación de Dios. Se explorarán los principales grupos de libros: el Pentateuco, los libros históricos, los libros poéticos y los escritos proféticos, abarcando desde Génesis hasta Malaquías. A lo largo del curso, se analizarán los eventos clave, los personajes principales y el mensaje central de cada sección, permitiendo a los estudiantes obtener una comprensión clara y ordenada del Antiguo Testamento y su relevancia para la fe cristiana.',
          fechaInicio: 'Domingo 01 de Junio',
          profesor: 'Marco Sanchez'
        }
      },
      {
        titulo: 'Sintesis del Nuevo Testamento',
        subtitulo: '(Curso Basico)',
        imagen: 'assets/img/portfolio/4.jpg',
        estado: null,
        modal: {
          tituloModal: 'Síntesis del Nuevo Testamento',
          intro: 'La Revelación de Cristo y su Iglesia.',
          imagenModal: 'assets/img/portfolio/4.jpg',
          descripcion: 'Este curso proporciona una visión general del Nuevo Testamento, ayudando a los participantes a comprender su estructura, mensaje y propósito en la revelación divina. Se explorarán los Evangelios, el libro de Hechos, las epístolas paulinas y generales, y el libro de Apocalipsis, analizando su contenido y relevancia para la vida cristiana. A lo largo del estudio, se examinarán los eventos clave del ministerio de Jesús, la expansión de la iglesia primitiva, las enseñanzas apostólicas y la esperanza escatológica, brindando una comprensión clara y estructurada del Nuevo Testamento y su impacto en la fe cristiana.',
          fechaInicio: 'Domingo 10 de Agosto',
          profesor: 'Efrain Villafuerte'
        }
      },
      {
        titulo: 'Servicio Ministerial',
        subtitulo: '(Curso Basico)',
        imagen: 'assets/img/portfolio/5.jpg',
        estado: null,
        modal: {
          tituloModal: 'Servicio Ministerial',
          intro: 'Descubriendo y Ejercitando los Dones en la Iglesia.',
          imagenModal: 'assets/img/portfolio/5.jpg',
          descripcion: 'Este curso tiene como objetivo ayudar a cada cristiano a comprender su propósito dentro de la congregación, descubriendo y practicando los dones espirituales para el servicio en los ministerios de la iglesia. Se explorarán los dones espirituales vigentes, su función en el cuerpo de Cristo y cómo identificarlos y desarrollarlos. Además, se analizarán los diferentes ministerios dentro de la iglesia, el rol de la mujer en el servicio y la importancia de la participación activa en la obra de Dios. A través de este estudio, los participantes podrán reconocer su llamado y contribuir de manera efectiva al crecimiento y fortalecimiento de la iglesia.',
          fechaInicio: 'Domingo 05 de Octubre',
          profesor: 'Eliezer Villafuerte'
        }
      },
      {
        titulo: 'Metodos de Evangelismo General',
        subtitulo: '(Curso Avanzado)',
        imagen: 'assets/img/portfolio/6.png',
        estado: 'en-curso',
        modal: {
          tituloModal: 'Métodos de Evangelismo General',
          intro: 'Estrategias Prácticas para Alcanzar a Más Personas.',
          imagenModal: 'assets/img/portfolio/6.png',
          descripcion: 'Este curso profundiza en diferentes estrategias y métodos de evangelismo, tanto a nivel personal como comunitario. Se explorarán enfoques como el evangelismo masivo, el evangelismo relacional, el uso de medios de comunicación y las campañas de alcance. Además, se analizarán casos prácticos de evangelismo en diferentes contextos culturales y sociales, brindando herramientas para adaptar el mensaje del evangelio a distintos públicos. Al finalizar el curso, los participantes estarán mejor equipados para diseñar e implementar estrategias efectivas de evangelismo en su iglesia y comunidad.',
          fechaInicio: 'Domingo 02 de Febrero',
          profesor: 'Marco Sanchez'
        }
      },
      {
        titulo: 'Introduccion a la Teologia Sistematica',
        subtitulo: '(Curso Avanzado)',
        imagen: 'assets/img/portfolio/7.png',
        estado: null,
        modal: {
          tituloModal: 'Introducción a la Teología Sistemática',
          intro: 'Fundamentos Doctrinales de la Fe Cristiana.',
          imagenModal: 'assets/img/portfolio/7.png',
          descripcion: 'Este curso ofrece un estudio organizado de las doctrinas fundamentales del cristianismo, ayudando a los estudiantes a comprender y articular su fe de manera coherente. Se explorarán temas como la naturaleza de Dios, la Trinidad, la creación, la caída del hombre, la persona y obra de Cristo, la salvación, la iglesia y los eventos futuros. A través de un análisis bíblico y teológico, los participantes aprenderán a fundamentar sus creencias en la Escritura y a responder con claridad a preguntas doctrinales. Este curso es esencial para aquellos que desean crecer en su entendimiento de la fe cristiana y servir con mayor eficacia en la enseñanza y liderazgo.',
          fechaInicio: 'Domingo 06 de Abril',
          profesor: 'Efrain Villafuerte'
        }
      },
      {
        titulo: 'Bibliología',
        subtitulo: '(Curso Avanzado)',
        imagen: 'assets/img/portfolio/8.png',
        estado: null,
        modal: {
          tituloModal: 'Bibliología',
          intro: 'El Estudio de la Palabra de Dios.',
          imagenModal: 'assets/img/portfolio/8.png',
          descripcion: 'Este curso explora el estudio de la Biblia como la Palabra de Dios, abordando temas como la inspiración, la autoridad, la canonicidad, la transmisión del texto bíblico y los principios de interpretación. Se analizará cómo se formó el canon de las Escrituras, la confiabilidad de los manuscritos y la importancia de la hermenéutica en la correcta comprensión de la Biblia. Además, se estudiarán las diferentes traducciones y versiones de la Biblia, ayudando a los participantes a seleccionar las más adecuadas para el estudio personal y la enseñanza. Este curso es fundamental para aquellos que desean profundizar en el conocimiento de la Biblia y su aplicación en la vida cristiana.',
          fechaInicio: 'Domingo 01 de Junio',
          profesor: 'Marco Sanchez'
        }
      },
      {
        titulo: 'Homiletica',
        subtitulo: '(Curso Avanzado)',
        imagen: 'assets/img/portfolio/9.png',
        estado: null,
        modal: {
          tituloModal: 'Homilética',
          intro: 'El Arte de Predicar la Palabra.',
          imagenModal: 'assets/img/portfolio/9.png',
          descripcion: 'Este curso capacita a los estudiantes en el arte y la ciencia de la predicación, proporcionando herramientas prácticas para preparar y presentar sermones bíblicos efectivos. Se explorarán diferentes tipos de sermones, métodos de estudio bíblico para la predicación, estructura de un mensaje y técnicas de comunicación. Además, se analizarán ejemplos de grandes predicadores y se brindará retroalimentación práctica mediante la predicación en clase. Al finalizar el curso, los participantes estarán equipados para proclamar la Palabra de Dios con claridad, convicción y poder, ayudando a edificar la iglesia y transformar vidas.',
          fechaInicio: 'Domingo 10 de Agosto',
          profesor: 'Eliezer Villafuerte'
        }
      },
      {
        titulo: 'Misiología',
        subtitulo: '(Curso Avanzado)',
        imagen: 'assets/img/portfolio/10.png',
        estado: null,
        modal: {
          tituloModal: 'Misiología',
          intro: 'El Llamado y Estrategia de las Misiones.',
          imagenModal: 'assets/img/portfolio/10.png',
          descripcion: 'Este curso explora la teología y práctica de las misiones cristianas, ayudando a los participantes a comprender el llamado de Dios a llevar el evangelio hasta lo último de la tierra. Se estudiarán principios bíblicos de las misiones, la historia del movimiento misionero, estrategias de alcance transcultural y los desafíos contemporáneos del campo misionero. Además, se analizarán modelos de plantación de iglesias, contexto cultural y la importancia de la oración y el apoyo en la obra misionera. Al finalizar el curso, los estudiantes tendrán una visión clara de su rol en la Gran Comisión y estarán preparados para participar activamente en la expansión del Reino de Dios.',
          fechaInicio: 'Domingo 05 de Octubre',
          profesor: 'Marco Sanchez'
        }
      }
    ]
  },

  // ===== SECCIÓN ABOUT/TIMELINE (FASE 3) =====
  seccionAbout: {
    visible: true,
    titulo: 'Propósito de la Escuela Bíblica',
    subtitulo: '¿Por qué existe este ministerio?',
    items: [
      {
        titulo: 'MISIÓN',
        subtitulo: 'Formación Integral en la Palabra',
        descripcion: 'Formar creyentes firmes en la fe, con un conocimiento profundo de la Palabra de Dios, capacitados para aplicar principios bíblicos en su vida diaria y preparados para servir en la obra del Señor.',
        imagen: 'assets/img/about/1.jpg',
        invertido: false
      },
      {
        titulo: 'VISIÓN',
        subtitulo: 'Creciendo en el Conocimiento y Servicio',
        descripcion: 'Ofrecer una enseñanza sólida y práctica, que impulse el crecimiento espiritual de los creyentes y equipe obreros para el servicio en la iglesia local y la expansión del evangelio.',
        imagen: 'assets/img/about/2.webp',
        invertido: true
      },
      {
        titulo: 'OBJETIVO',
        subtitulo: 'Capacitación para la Vida y el Ministerio',
        descripcion: 'Proporcionar una educación bíblica estructurada, que ayude a los estudiantes a desarrollar su vida espiritual, doctrinal y ministerial, fortaleciendo su relación con Dios y su compromiso con la gran comisión.',
        imagen: 'assets/img/about/3.jpg',
        invertido: false
      },
      {
        titulo: 'COMPROMISO',
        subtitulo: 'Edificando una Generación Fiel',
        descripcion: 'Promover una formación cristiana que transforme vidas, fomentando el amor por Dios, el estudio de las Escrituras y el servicio activo en la iglesia, para que cada creyente impacte su entorno con el evangelio.',
        imagen: 'assets/img/about/4.webp',
        invertido: true
      }
    ],
    itemFinal: {
      linea1: 'Tu también',
      linea2: 'Puedes',
      linea3: 'Ser Parte'
    }
  },

  // ===== SECCIÓN PROFESORES (FASE 4) =====
  seccionProfesores: {
    visible: true,
    titulo: 'PROFESORES',
    subtitulo: 'Equipo de maestros de la Escuela Bíblica',
    textoFooter: 'Con pasión por el evangelio y experiencia en el servicio, nuestros docentes se esfuerzan por transmitir las verdades bíblicas de manera clara y práctica, fomentando el aprendizaje y la aplicación de la enseñanza en la vida diaria.',
    descripcionPie: 'Con pasión por el evangelio y experiencia en el servicio, nuestros docentes se esfuerzan por transmitir las verdades bíblicas de manera clara y práctica, fomentando el aprendizaje y la aplicación de la enseñanza en la vida diaria.',
    usarProfesoresReales: true
  },

  // ===== SECCIÓN INSCRIPCIÓN (FASE 5) =====
  seccionInscripcion: {
    visible: true,
    titulo: '¿Listo para empezar?',
    subtitulo: 'Inscríbete ahora en nuestra Escuela Bíblica',
    descripcion: 'Crea tu cuenta y solicita tu inscripción. Mira nuestro tutorial para conocer el proceso paso a paso.',
    botonTexto: 'Inscribirme Ahora',
    botonLink: '/login',
    videoYoutube: '',
    videoTitulo: 'Tutorial: Cómo crear cuenta y solicitar inscripción'
  },

  // ===== SECCIÓN FOOTER (FASE 6) =====
  footer: {
    visible: true,
    textoCopyright: 'Escuela Biblica CAVEVID',
    anioCopyright: 2025,
    redesSociales: [
      { tipo: 'facebook', url: '', visible: false },
      { tipo: 'instagram', url: '', visible: false },
      { tipo: 'twitter', url: '', visible: false },
      { tipo: 'youtube', url: '', visible: false },
      { tipo: 'linkedin', url: '', visible: false }
    ],
    whatsappVisible: true,
    whatsappTexto: 'Contacto WhatsApp:',
    whatsappNumero: '+591 63332108',
    whatsappMensaje: 'Hola, quiero participar del curso de la Escuela Biblica!'
  }
};
