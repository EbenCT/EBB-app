# 🎓 Escuela Bíblica CAVEVID - Sistema de Gestión

Sistema web completo para la gestión de Escuela Bíblica con Angular 17, Firebase y panel de administración.

## 🚀 Deployment en Vercel (Auto-Deploy con Git)

### 📋 Requisitos previos
- Cuenta en GitHub
- Cuenta en Vercel (gratis)
- Proyecto en un repositorio Git

---

## 🔧 Configuración automática

Este proyecto ya está **100% configurado** para Vercel:

### ✅ Archivos de configuración incluidos:

1. **`vercel.json`** - Configuración principal de Vercel
2. **`package.json`** - Script `vercel-build` configurado
3. **`.vercelignore`** - Archivos que Vercel ignorará

---

## 📝 El archivo `vercel.json` explicado:

```json
{
  "version": 2,                          // Versión de configuración de Vercel
  "name": "escuela-biblica-cavevid",    // Nombre del proyecto en Vercel
  
  "builds": [
    {
      "src": "package.json",                           // Archivo fuente
      "use": "@vercel/static-build",                   // Builder para apps Angular
      "config": {
        "distDir": "dist/escuela-biblica-app/browser" // Carpeta de salida de Angular 17
      }
    }
  ],
  
  "routes": [
    {
      "src": "/(.*)",          // Todas las rutas (/**)
      "dest": "/index.html"    // Redirige a index.html (para Angular routing)
    }
  ]
}
```

### 🔍 ¿Para qué sirve cada parte?

#### 1. **`builds`**: Le dice a Vercel cómo compilar tu app
- Detecta que es un proyecto Angular por `package.json`
- Usa el builder específico para apps estáticas
- Le indica dónde Angular genera los archivos compilados

#### 2. **`routes`**: Maneja el routing de Angular
- **SIN este archivo**: Ir a `/login` en el navegador daría error 404
- **CON este archivo**: Todas las rutas (`/login`, `/admin`, `/home`, etc.) redirigen a `index.html`
- Esto permite que el router de Angular maneje las rutas

---

## 🚀 Cómo deployar en Vercel (paso a paso)

### Opción 1: Deploy automático desde GitHub (RECOMENDADO)

1. **Sube tu código a GitHub:**
   ```bash
   git add .
   git commit -m "Configuración para Vercel"
   git push origin main
   ```

2. **Ve a Vercel:**
   - Entra a: https://vercel.com
   - Click en "Add New" → "Project"

3. **Importa tu repositorio:**
   - Conecta tu cuenta de GitHub
   - Selecciona tu repositorio
   - Click en "Import"

4. **Configuración automática:**
   - Vercel detecta que es Angular
   - **Framework Preset**: Detecta "Angular" automáticamente
   - **Build Command**: `npm run vercel-build` (ya configurado)
   - **Output Directory**: `dist/escuela-biblica-app/browser` (ya en vercel.json)
   - Click en "Deploy"

5. **¡Listo!** 🎉
   - En 2-3 minutos tu app estará en línea
   - Te darán una URL tipo: `https://tu-proyecto.vercel.app`

### 🔄 ¿Qué pasa después?

**AUTO-DEPLOY ACTIVADO:**
- Cada vez que hagas `git push` a tu rama `main`
- Vercel automáticamente:
  1. 🔍 Detecta el cambio
  2. 🏗️ Construye el proyecto (`npm run vercel-build`)
  3. 🚀 Despliega la nueva versión
  4. ✅ Tu sitio se actualiza en ~2 minutos

**NO necesitas hacer NADA manual** - solo push a Git.

---

## 🌐 Agregar tu dominio personalizado

1. **En Vercel:**
   - Ve a tu proyecto → "Settings" → "Domains"
   - Agrega tu dominio (ej: `escuela-biblica.com`)

2. **En tu proveedor de dominio:**
   - Agrega los registros DNS que Vercel te indique
   - Tipo A → apunta a IP de Vercel
   - Tipo CNAME → `cname.vercel-dns.com`

3. **Espera 24-48 horas** para propagación DNS

4. **SSL automático** - Vercel te da HTTPS gratis

---

## 🔥 Variables de entorno (Firebase)

**IMPORTANTE:** Tu archivo `src/environments/environment.ts` con las credenciales de Firebase debe estar en el proyecto.

Si quieres usar variables de entorno en Vercel:

1. Ve a "Settings" → "Environment Variables"
2. Agrega (opcional, solo si quieres mayor seguridad):
   ```
   FIREBASE_API_KEY=tu-api-key
   FIREBASE_AUTH_DOMAIN=tu-auth-domain
   etc...
   ```

---

## 📦 Estructura del proyecto para Vercel

```
escuela-biblica-app/
├── src/                          # Código fuente Angular
├── dist/                         # Carpeta de build (generada)
│   └── escuela-biblica-app/
│       └── browser/              # Archivos que Vercel sirve
├── vercel.json                   # ⭐ Configuración de Vercel
├── .vercelignore                 # Archivos a ignorar en deploy
├── package.json                  # Dependencias + script vercel-build
└── angular.json                  # Configuración Angular
```

---

## 🛠️ Comandos útiles

```bash
# Desarrollo local
npm start                         # Corre en http://localhost:4200

# Build de producción (lo mismo que hace Vercel)
npm run vercel-build             # Genera dist/escuela-biblica-app/browser/

# Instalar Vercel CLI (opcional, para preview local)
npm i -g vercel
vercel dev                        # Simula Vercel en local
vercel deploy --prod             # Deploy manual (si no usas Git)
```

---

## ✅ Checklist antes de hacer deploy

- [ ] Código subido a GitHub
- [ ] `vercel.json` en la raíz del proyecto
- [ ] Script `vercel-build` en `package.json`
- [ ] Firebase configurado en `src/environments/environment.ts`
- [ ] Probado localmente con `npm start`

---

## 🎯 Beneficios de esta configuración

✅ **Auto-deploy**: Git push → Deploy automático  
✅ **Gratis para siempre**: Sin límites de tráfico razonables  
✅ **SSL/HTTPS**: Gratis y automático  
✅ **CDN global**: Tu app será rápida en todo el mundo  
✅ **Preview deployments**: Cada PR tiene su propio preview  
✅ **Rollback fácil**: Vuelve a versiones anteriores con 1 click  

---

## 📚 Stack Tecnológico

- **Frontend**: Angular 17 (Standalone Components)
- **Backend**: Firebase (Firestore + Authentication + Storage)
- **Hosting**: Vercel
- **Deployment**: GitHub + Vercel (CI/CD automático)

---

## 🤝 Soporte

Para problemas con el deployment:
- Documentación Vercel: https://vercel.com/docs
- Logs en Vercel Dashboard: Ver errores de build
- Firebase Console: https://console.firebase.google.com

---

**Desarrollado para Escuela Bíblica CAVEVID** 🙏
