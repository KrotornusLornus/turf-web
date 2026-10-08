'use strict';

const DATA_URL = '/partituras.json';

const CATEGORIAS = [
  { id: 'Todos', label: 'Todos' },
  { id: 'Caballos', label: 'Caballos' },
  { id: 'Jockeys y personajes', label: 'Jockeys y personajes' },
  { id: 'Studs e instituciones', label: 'Studs e instituciones' },
  { id: 'Carreras y apuestas', label: 'Carreras y apuestas' },
  { id: 'Sin clasificar', label: 'Sin clasificar' },
  { id: 'Con audio', label: '♪ Con audio' }
];

let allItems = [];
const state = { query: '', categoria: 'Todos' };

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatTitle(title) {
  return String(title || '').trim();
}

function matchesCategoria(item, categoria) {
  if (categoria === 'Todos') return true;
  if (categoria === 'Con audio') return !!item.audio;
  return Array.isArray(item.categorias) && item.categorias.includes(categoria);
}

function matchesQuery(item, query) {
  const q = normalizeText(query).trim();
  if (!q) return true;
  const haystack = normalizeText(
    (item.titulo || '') + ' ' + (item.autor || '') + ' ' + (item.descripcion || '')
  );
  return haystack.includes(q);
}

function countFor(categoria) {
  if (categoria === 'Todos') return allItems.length;
  return allItems.filter((item) => matchesCategoria(item, categoria)).length;
}

function buildChips() {
  const chipsBox = document.getElementById('chips');
  if (!chipsBox) return;

  chipsBox.textContent = '';
  for (const cat of CATEGORIAS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.cat = cat.id;

    const label = document.createElement('span');
    label.textContent = cat.label;
    chip.appendChild(label);

    const count = document.createElement('span');
    count.className = 'chip-count';
    count.textContent = String(countFor(cat.id));
    chip.appendChild(count);

    chip.addEventListener('click', () => {
      state.categoria = state.categoria === cat.id ? 'Todos' : cat.id;
      applyFilters();
    });

    chipsBox.appendChild(chip);
  }
}

function updateChips() {
  const chipsBox = document.getElementById('chips');
  if (!chipsBox) return;
  for (const chip of chipsBox.querySelectorAll('.chip')) {
    chip.classList.toggle('active', chip.dataset.cat === state.categoria);
  }
}

function thumbSrc(item) {
  return item.imagen ? item.imagen.replace('imagenes/', 'imagenes/thumbs/') : item.imagen;
}

function makeImg(src, alt) {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = alt;
  img.src = src;

  // Si la miniatura no existe (p. ej. una imagen recién subida sin thumb),
  // se recurre una sola vez al original.
  if (src && src.indexOf('imagenes/thumbs/') === 0) {
    img.addEventListener('error', () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.src = src.replace('imagenes/thumbs/', 'imagenes/');
    });
  }

  return img;
}

function renderGrid(items) {
  const grid = document.getElementById('catalogo-grid');
  if (!grid) return;

  grid.textContent = '';
  const cards = items.map((item, index) => renderCard(item, index));
  grid.append(...cards);
}

function renderCard(item, index) {
  const title = formatTitle(item.titulo);
  const author = item.autor || '';
  const hasAudio = !!item.audio;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'grid-card';
  card.dataset.index = String(index);

  const thumb = document.createElement('div');
  thumb.className = 'grid-card-thumb';
  thumb.appendChild(makeImg(thumbSrc(item), title));

  if (hasAudio) {
    const badge = document.createElement('span');
    badge.className = 'grid-card-play';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = '▶';
    thumb.appendChild(badge);
  }

  const meta = document.createElement('div');
  meta.className = 'grid-card-meta';

  const titleEl = document.createElement('div');
  titleEl.className = 'grid-card-title';
  titleEl.textContent = title;

  meta.appendChild(titleEl);

  if (author) {
    const authorEl = document.createElement('div');
    authorEl.className = 'grid-card-author';
    authorEl.textContent = author;
    meta.appendChild(authorEl);
  }

  card.appendChild(thumb);
  card.appendChild(meta);

  const open = () => openDetail(item);
  card.addEventListener('click', open);
  return card;
}

function applyFilters() {
  const filtered = allItems.filter(
    (item) => matchesCategoria(item, state.categoria) && matchesQuery(item, state.query)
  );

  updateChips();

  const estado = document.getElementById('estado-filtros');
  const count = document.getElementById('resultado-count');
  const vacio = document.getElementById('sin-resultados');
  const filtersActive = state.query.trim() !== '' || state.categoria !== 'Todos';

  if (estado) estado.hidden = !filtersActive;
  if (count) {
    count.textContent = filtered.length + ' de ' + allItems.length + ' obras';
  }
  if (vacio) vacio.hidden = filtered.length !== 0;

  renderGrid(filtered);
}

function clearFilters() {
  state.query = '';
  state.categoria = 'Todos';
  const buscador = document.getElementById('buscador');
  if (buscador) buscador.value = '';
  applyFilters();
}

const buscador = document.getElementById('buscador');
if (buscador) {
  buscador.addEventListener('input', () => {
    state.query = buscador.value;
    applyFilters();
  });
}

const limpiarBtn = document.getElementById('limpiar-filtros');
if (limpiarBtn) {
  limpiarBtn.addEventListener('click', clearFilters);
}

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxAuthor = document.getElementById('lightbox-author');
const lightboxDesc = document.getElementById('lightbox-desc');
const lightboxAudio = document.getElementById('lightbox-audio');

/* ---------- Reproductor de audio ---------- */

const playerState = { audio: null, els: null };

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '—:—';
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return m + ':' + s;
}

function teardownPlayer() {
  if (playerState.audio) {
    playerState.audio.pause();
    playerState.audio.removeAttribute('src');
    playerState.audio.load();
    playerState.audio = null;
  }
  playerState.els = null;
}

function buildPlayer(src) {
  const box = document.createElement('div');
  box.className = 'detail-player';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'player-play';
  playBtn.setAttribute('aria-label', 'Reproducir');
  playBtn.textContent = '▶';

  const body = document.createElement('div');
  body.className = 'player-body';

  const bar = document.createElement('div');
  bar.className = 'player-bar';
  bar.setAttribute('role', 'slider');
  bar.setAttribute('aria-label', 'Progreso de la obra');

  const fill = document.createElement('div');
  fill.className = 'player-bar-fill';
  bar.appendChild(fill);

  const times = document.createElement('div');
  times.className = 'player-times';

  const cur = document.createElement('span');
  cur.className = 'player-time-current';
  cur.textContent = '0:00';

  const orn = document.createElement('span');
  orn.className = 'player-orn';
  orn.setAttribute('aria-hidden', 'true');
  orn.textContent = '♪';

  const dur = document.createElement('span');
  dur.className = 'player-time-total';
  dur.textContent = '—:—';

  times.appendChild(cur);
  times.appendChild(orn);
  times.appendChild(dur);

  body.appendChild(bar);
  body.appendChild(times);

  const volBtn = document.createElement('button');
  volBtn.type = 'button';
  volBtn.className = 'player-vol';
  volBtn.setAttribute('aria-label', 'Silenciar');
  volBtn.setAttribute('aria-hidden', 'false');
  volBtn.textContent = '♪';

  box.appendChild(playBtn);
  box.appendChild(body);
  box.appendChild(volBtn);

  const audio = document.createElement('audio');
  audio.preload = 'none';
  audio.src = src;

  playerState.audio = audio;
  playerState.els = { box, playBtn, bar, fill, cur, dur, volBtn };

  const setPlaying = () => {
    playBtn.textContent = '❚❚';
    playBtn.setAttribute('aria-label', 'Pausar');
  };
  const setPaused = () => {
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Reproducir');
  };

  audio.addEventListener('loadedmetadata', () => {
    dur.textContent = fmtTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    cur.textContent = fmtTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      fill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
    }
  });
  audio.addEventListener('playing', () => {
    box.classList.remove('is-loading');
    setPlaying();
  });
  audio.addEventListener('pause', setPaused);
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    fill.style.width = '0%';
    cur.textContent = '0:00';
    setPaused();
  });
  audio.addEventListener('waiting', () => box.classList.add('is-loading'));
  audio.addEventListener('error', () => box.classList.remove('is-loading'));

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      box.classList.add('is-loading');
      audio.play().catch(() => box.classList.remove('is-loading'));
    } else {
      audio.pause();
      setPaused();
    }
  });

  const seek = (clientX) => {
    const rect = bar.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = ratio * audio.duration;
      fill.style.width = ratio * 100 + '%';
      cur.textContent = fmtTime(audio.currentTime);
    }
  };

  let dragging = false;
  bar.addEventListener('pointerdown', (e) => {
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    seek(e.clientX);
  });
  bar.addEventListener('pointermove', (e) => {
    if (dragging) seek(e.clientX);
  });
  bar.addEventListener('pointerup', () => {
    dragging = false;
  });
  bar.addEventListener('pointercancel', () => {
    dragging = false;
  });

  volBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    volBtn.classList.toggle('is-muted', audio.muted);
    volBtn.setAttribute('aria-label', audio.muted ? 'Activar sonido' : 'Silenciar');
  });

  return box;
}

function openDetail(item) {
  const title = formatTitle(item.titulo);

  lightboxImg.src = item.imagen;
  lightboxImg.alt = title;
  lightboxTitle.textContent = title;

  const author = (item.autor || '').trim();
  lightboxAuthor.textContent = author;
  lightboxAuthor.hidden = !author;

  lightboxDesc.textContent = item.descripcion || '';

  teardownPlayer();
  lightboxAudio.textContent = '';
  if (item.audio) {
    lightboxAudio.appendChild(buildPlayer(item.audio));
    lightboxAudio.hidden = false;
  } else {
    lightboxAudio.hidden = true;
  }

  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  teardownPlayer();
  lightbox.hidden = true;
  lightboxImg.src = '';
  lightboxAudio.textContent = '';
  document.body.style.overflow = '';
}

document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    allItems = await res.json();
    buildChips();
    applyFilters();
  } catch (err) {
    const grid = document.getElementById('catalogo-grid');
    if (grid) {
      grid.textContent = 'No se pudo cargar el catálogo.';
      grid.classList.add('grid-error');
    }
    console.error('No se pudieron cargar los datos:', err);
  }
}

loadData();
