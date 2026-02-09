# 🎓 Escuela Bíblica CAVEVID - Sistema de Gestión

Sistema web completo para la administración y gestión de Escuela Bíblica con panel de administración, gestión de estudiantes, profesores y contenido dinámico.

## 🚀 Tecnologías

- **Angular 17** - Framework frontend con Standalone Components
- **Firebase** - Backend as a Service
  - Firestore - Base de datos
  - Authentication - Sistema de login
  - Storage - Almacenamiento de archivos
- **Cloudinary** - Gestión de imágenes
- **Vercel** - Hosting y deployment

## 📋 Características

### Para Administradores
- ✅ Panel de administración completo
- ✅ Gestión de usuarios (estudiantes y profesores)
- ✅ Configuración dinámica del Home (6 fases completas)
- ✅ Gestión de cursos y materias
- ✅ Control de inscripciones
- ✅ Dashboard con estadísticas

### Para Profesores
- ✅ Gestión de materias asignadas
- ✅ Asignación de actividades
- ✅ Revisión de trabajos
- ✅ Calificaciones

### Para Estudiantes
- ✅ Inscripción en cursos
- ✅ Visualización de materias
- ✅ Sistema de desbloqueo progresivo
- ✅ Entrega de actividades
- ✅ Seguimiento de progreso

## 🛠️ Instalación

```bash
# Clonar el repositorio
git clone <tu-repositorio>

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm start
```

La aplicación estará disponible en `http://localhost:4200/`

## 🚀 Deployment en Vercel

Este proyecto está preconfigurado para Vercel con auto-deploy desde GitHub.

**Ver guía completa:** [DEPLOYMENT.md](./DEPLOYMENT.md)

**Resumen rápido:**
1. Sube el código a GitHub
2. Importa el proyecto en Vercel
3. Vercel detecta Angular automáticamente
4. Cada `git push` despliega automáticamente

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── core/                  # Servicios, guards, modelos
│   ├── features/             # Módulos por funcionalidad
│   │   ├── admin/           # Panel de administración
│   │   ├── estudiante/      # Dashboard estudiante
│   │   └── profesor/        # Dashboard profesor
│   ├── shared/              # Componentes compartidos
│   └── static-pages/        # Páginas públicas (home, login)
├── assets/                  # Imágenes, estilos, scripts
└── environments/            # Configuración Firebase
```

## 🔑 Roles y Permisos

- **Admin**: Acceso total al sistema
- **Profesor**: Gestión de materias y actividades
- **Estudiante**: Acceso a cursos y actividades

## 📦 Scripts Disponibles

```bash
npm start              # Servidor de desarrollo
npm run build          # Build de producción
npm run vercel-build   # Build para Vercel (automático)
npm test               # Tests unitarios
```

## 🔐 Seguridad

- Reglas de Firestore configuradas en `firestore.rules`
- Guards de Angular para protección de rutas
- Validación de roles en backend y frontend

## 📝 Configuración Firebase

Actualizar `src/environments/environment.ts` con tus credenciales:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "tu-api-key",
    authDomain: "tu-auth-domain",
    projectId: "tu-project-id",
    // ... resto de configuración
  }
};
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-caracteristica`)
3. Commit cambios (`git commit -m 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y está desarrollado para Escuela Bíblica CAVEVID.

---

**Desarrollado con ❤️ para Escuela Bíblica CAVEVID** 🙏
