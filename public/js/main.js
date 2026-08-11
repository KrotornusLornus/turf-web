'use strict';

const PARTITURAS_URL = '/partituras_carlos_wolf.json';
const TANGOS_URL = '/tangos_costa_baleta.json';

const ARTIST_NAMES = {
  'carlos gardel': 'Carlos Gardel',
  'jorge vidal': 'Jorge Vidal',
  'edmundo rivero': 'Edmundo Rivero',
  'abel cordoba': 'Abel Córdoba',
  'jorge beiro': 'Jorge Beiró',
  'alberto gomez': 'Alberto Gómez',
  'alberto echague': 'Alberto Echagüe',
  'juan darienzo': "Juan D'Arienzo",
  'angel vargas': 'Ángel Vargas',
  'angel dagostino': "Ángel D'Agostino",
  'felix romero': 'Félix Romero',
  'donato racciatti': 'Donato Racciatti',
  'eduardo pulis': 'Eduardo Pulis'
};

const FALLBACK_ARTISTS = {
  'preparate-pal-domingo': 'Carlos Gardel',
  'para-el-viejo-leguisamo': 'Jorge Vidal',
  'pista-15': 'Jorge Beiró',
  'para-el-chupino-noriega': 'Eduardo Pulis',
  'pingo-lindo': 'Jorge Vidal',
  'y-nadie-sabe-mas-que-vos': 'Abel Córdoba'
};

function decodeEntities(str) {
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function prettyArtist(slugged) {
  if (ARTIST_NAMES[slugged]) return ARTIST_NAMES[slugged];
  return slugged
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function extractArtist(url, title, slug) {
  if (FALLBACK_ARTISTS[slug]) return FALLBACK_ARTISTS[slug];

  const base = url.split('/').pop().replace(/\.mp3$/i, '');
  const t = slugify(title);
  const parts = [];

  for (const seg of base.split('_')) {
    const s = slugify(seg);
    if (t && s.length > t.length && s.endsWith(t)) {
      const artist = s.slice(0, -t.length).trim();
      if (artist) parts.push(prettyArtist(artist));
    }
  }

  return parts.join(' y ');
}

function isScannedTitle(title) {
  return /^ScannedImage/i.test(title);
}

function renderPartituras(items) {
  const strip = document.getElementById('partituras-strip');

  const cards = items.map((p) => {
    const title = decodeEntities(p.titulo);
    const fig = document.createElement('figure');
    fig.className = 'strip-card';
    fig.tabIndex = 0;

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = title;
    img.src = p.url;

    fig.appendChild(img);

    if (!isScannedTitle(title)) {
      const cap = document.createElement('figcaption');
      cap.textContent = title;
      fig.appendChild(cap);
    }

    fig.addEventListener('click', () => openLightbox(p.url, title));
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(p.url, title);
      }
    });

    return fig;
  });

  strip.append(...cards);
}

function renderTangos(tangos) {
  const list = document.getElementById('tangos-list');

  const items = tangos.map((t) => {
    const title = decodeEntities(t.titulo);
    const artist = extractArtist(t.url, title, t.slug);

    const item = document.createElement('div');
    item.className = 'tango-item';

    const info = document.createElement('div');
    info.className = 'tango-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'tango-title';
    titleEl.textContent = title;

    const artistEl = document.createElement('div');
    artistEl.className = 'tango-artist';
    artistEl.textContent = artist || 'Tangos de Turf';

    info.appendChild(titleEl);
    info.appendChild(artistEl);

    const audio = document.createElement('audio');
    audio.className = 'tango-audio';
    audio.controls = true;
    audio.preload = 'none';
    audio.src = t.url;

    item.appendChild(info);
    item.appendChild(audio);
    return item;
  });

  list.append(...items);
}

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');

function openLightbox(url, title) {
  lightboxImg.src = url;
  lightboxImg.alt = title;
  lightboxCaption.textContent = title;
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = '';
  document.body.style.overflow = '';
}

document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

const strip = document.getElementById('partituras-strip');
document.querySelector('.strip-arrow-prev').addEventListener('click', () => {
  strip.scrollBy({ left: -680, behavior: 'smooth' });
});
document.querySelector('.strip-arrow-next').addEventListener('click', () => {
  strip.scrollBy({ left: 680, behavior: 'smooth' });
});

async function loadAll() {
  try {
    const [partituras, tangos] = await Promise.all([
      fetch(PARTITURAS_URL).then((r) => r.json()),
      fetch(TANGOS_URL).then((r) => r.json())
    ]);
    renderPartituras(partituras);
    renderTangos(tangos);
  } catch (err) {
    console.error('No se pudieron cargar los datos:', err);
  }
}

loadAll();
