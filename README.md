# Portafolio Web — Carlos

Portafolio personal. Estudiante de Ingeniería Mecatrónica con enfoque en IA, robótica y automatización.

## Estructura del proyecto

```
Portafolio Web/
├── index.html                 # Página principal
├── README.md                  # Este archivo
└── assets/
    ├── css/                   # Hojas de estilo (cuando se extraiga el CSS del HTML)
    ├── js/                    # Scripts (cuando se extraiga el JS del HTML)
    ├── images/
    │   ├── profile/           # Fotos personales (perfil, about, hero)
    │   ├── projects/          # Screenshots y fotos de proyectos
    │   └── events/            # Fotos de eventos, competencias, viajes
    ├── certificates/          # Certificados (PNG, JPG o PDF)
    ├── documents/
    │   └── cv.pdf             # CV descargable
    └── icons/                 # Favicon, logos, íconos propios
```

## Qué archivo va dónde

| Tipo de archivo | Carpeta | Ejemplo |
|---|---|---|
| Foto tuya (perfil, about) | `assets/images/profile/` | `carlos-perfil.jpg` |
| Screenshot de un proyecto | `assets/images/projects/` | `exoskeleton.jpg` |
| Foto de evento / competencia | `assets/images/events/` | `Brazil2025.jpg` |
| Certificado | `assets/certificates/` | `cert-santander.png` |
| CV | `assets/documents/` | `cv.pdf` |
| Favicon / logo | `assets/icons/` | `favicon.ico` |

## Convención de nombres

- Todo en **minúsculas** y sin espacios. Usa guiones (`kebab-case`).
  - Bien: `cert-santander.png`, `proyecto-exoesqueleto.jpg`
  - Mal: `Cert Santander.png`, `Proyecto Exoesqueleto.JPG`
- Sé descriptivo pero corto. Si es un certificado, prefijo `cert-` ayuda a encontrarlo.
- Para proyectos, usa el nombre del proyecto. Si hay varias imágenes, numera: `proyecto-01.jpg`, `proyecto-02.jpg`.

## Formatos recomendados

- **Fotos**: `.jpg` o `.webp` (más livianos que PNG). Comprime antes de subir (TinyPNG, Squoosh).
- **Certificados**: `.png` si es imagen, `.pdf` si tiene texto seleccionable.
- **CV**: siempre `.pdf` con nombre `cv.pdf` (para que el link no cambie).
- **Íconos**: `.svg` cuando se pueda (escalan sin perder calidad).

## Tamaños objetivo

- Imágenes de proyectos: máx 1600px de ancho, <300 KB.
- Foto de perfil: 800×800 px, <150 KB.
- CV: <2 MB.

Páginas web lentas pierden visitantes. Comprimir imágenes es lo que más mueve la aguja.

## Cómo correr el sitio localmente

Opción rápida (si tienes Python):
```bash
python -m http.server 8000
```
Abre http://localhost:8000

## Pendientes

- [x] Links reales de GitHub, LinkedIn y email configurados.
- [x] CV real en `assets/documents/cv.pdf`.
- [ ] Extraer CSS y JS del `index.html` a `assets/css/` y `assets/js/` cuando crezca el proyecto.
- [ ] Agregar favicon (`assets/icons/favicon.ico`).
- [ ] Optimizar imágenes con TinyPNG / Squoosh antes de subir.
