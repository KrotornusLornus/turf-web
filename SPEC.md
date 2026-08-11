# Spec — Carlos Wolf · Tangos y Partituras del Turf

## Objetivo
Página web simple, de una sola vista, para difundir las obras de Carlos Wolf:
partituras de turf y tangos. La página es una **vitrina/catálogo**: **no descarga ni
almacena ningún contenido**. Todas las imágenes y audios se referencian por URL y se
cargan desde el sitio original (museodelturf.com.uy). Sin llamadas on-demand a la API.

## Datos
- `partituras_carlos_wolf.json` — ~80 imágenes (.jpg), campos: `id`, `slug`, `titulo`, `alt`, `url`.
- `tangos_costa_baleta.json` — 27 audios (.mp3), mismos campos.
- Los títulos traen entidades HTML (`&#8230;`, `¡`, `'`) que se decodifican en el navegador.
- El artista de cada tango se deduce del nombre de archivo (ej. `Carlos-Gardel-Leguisamo-Solo.mp3`
  → "Carlos Gardel"). Si no se deduce, se muestra solo el título.

## Estructura de archivos
```
turf-web/
├── server.js               # servidor http nativo de Node (0 dependencias)
├── package.json            # sin dependencias; "start" → node server.js (para Railway)
├── .gitignore
├── partituras_carlos_wolf.json
├── tangos_costa_baleta.json
├── SPEC.md                 # este documento
└── public/
    ├── index.html
    ├── css/styles.css
    └── js/main.js
```

## Servidor (`server.js`)
- Módulo `http` nativo. Sin `npm install`.
- Sirve archivos estáticos desde la raíz del proyecto con MIME correcto
  (`text/html`, `text/css`, `application/javascript`, `application/json`, `image/jpeg`, `audio/mpeg`).
- Puerta de entrada: `node server.js` → http://localhost:3000
- Ruta `/` → `public/index.html`; cualquier otra ruta → archivo correspondiente o 404.
- Puerto: usa `process.env.PORT` si existe (lo asigna Railway), si no 3000.
- Los dos JSON de datos viven en la raíz del proyecto y se sirven por su ruta.

## Deploy (Railway)
- `package.json` sin dependencias con `"start": "node server.js"`; Railway lo detecta y corre `npm start`.
- Sin build steps, sin variables de entorno adicionales.
- Los JSON se incluyen en el repo (son la data del sitio).

## Página única (`index.html`)
- **Hero**: título "Carlos Wolf" + subtítulo "Tangos y Partituras del Turf" + breve presentación.
- **Nav** con anclas: Partituras · Tangos · Acerca de.
- **Sección Partituras**:
  - Tira de tarjetas con **scroll horizontal** (CSS `overflow-x: auto` + `scroll-snap`).
  - Flechas ◀ ▶ (JS vanilla) para desplazar.
  - Cada tarjeta: imagen (`loading="lazy"`) + título.
  - Solo se muestra el título si es el nombre real de la obra; las partituras sin nombre
    (identificadas en el museo como "ScannedImage…") se muestran sin etiqueta.
  - Todas las cards tienen **altura fija** (312px PC / 280px móvil); la imagen ocupa todo
    el espacio disponible (`object-fit: contain`), así no quedan huecos cuando no hay etiqueta.
  - Clic en una tarjeta abre un **lightbox** (overlay oscuro) con la imagen en grande y botón de cerrar.
  - **Comportamiento responsive de la tira**:
    - Móvil: 1 card completa + un "peek" de la siguiente, con un **fade gradiente** en el borde derecho como pista visual de que se puede deslizar.
    - PC: cuando las cards no llenan el viewport, **se centran**; si hay más de las que caben, el scroll se comporta normal.
    - Padding al final del strip para que la última card nunca quede pegada al borde.
- **Sección Tangos**:
  - Lista de canciones con reproductor HTML5 inline (`<audio controls preload="none">`).
  - Muestra título + artista (cuando se deduce del nombre de archivo).
- **Sección Acerca de**: texto breve sobre Carlos Wolf + link a museodelturf.com.uy.
- **Footer**: crédito a Carlos Wolf + enlace al Museo del Turf.

## Lógica JS (`public/js/main.js` — vanilla, sin librerías)
1. `fetch` de los dos JSON.
2. Decodificación de entidades HTML en títulos.
3. Render de partituras (scroll horizontal) y tangos (reproductores).
4. Flechas de scroll + lightbox.

## Diseño (vintage, acorde a tango/turf)
- Paleta: burdeos/vinotinto + crema + dorado + verde turf.
- Tipografía serif clásica: Playfair Display + Lora (Google Fonts).
- Fondo con textura sutil estilo papel añejo, detalles dorados.
- Hero: eyebrow "Obras de Turf"; el Museo del Turf solo se menciona en "Acerca de" y el footer.
- Responsive: en pantallas chicas el scroll horizontal sigue siendo la forma de navegar las partituras.

## Fuera de alcance
- No se descarga nada; no hay copia local de imágenes/audios.
- No hay llamadas a la API de WordPress.
- No hay dependencias npm ni build steps.
