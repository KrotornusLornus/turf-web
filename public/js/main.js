'use strict';

const DATA_URL = '/partituras.json';

function formatTitle(title) {
  return String(title || '').trim();
}

function makeImg(src, alt) {
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = alt;
  img.src = src;
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
  thumb.appendChild(makeImg(item.imagen, title));

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

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxAuthor = document.getElementById('lightbox-author');
const lightboxDesc = document.getElementById('lightbox-desc');
const lightboxAudio = document.getElementById('lightbox-audio');

function openDetail(item) {
  const title = formatTitle(item.titulo);

  lightboxImg.src = item.imagen;
  lightboxImg.alt = title;
  lightboxTitle.textContent = title;

  const author = (item.autor || '').trim();
  lightboxAuthor.textContent = author;
  lightboxAuthor.hidden = !author;

  lightboxDesc.textContent = item.descripcion || '';

  lightboxAudio.textContent = '';
  if (item.audio) {
    const audio = document.createElement('audio');
    audio.className = 'detail-audio';
    audio.controls = true;
    audio.preload = 'none';
    audio.src = item.audio;
    lightboxAudio.appendChild(audio);
    lightboxAudio.hidden = false;
  } else {
    lightboxAudio.hidden = true;
  }

  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
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
    const items = await res.json();
    renderGrid(items);
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
