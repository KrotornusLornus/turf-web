'use strict';

/* Editor del catálogo — panel privado accesible desde el pie de página. */

(function () {
  const CATEGORIAS = [
    'Caballos',
    'Jockeys y personajes',
    'Studs e instituciones',
    'Carreras y apuestas',
    'Sin clasificar'
  ];
  const DRAFT_KEY = 'tw-editor-draft';

  let items = [];
  let editingIndex = -1;
  let dirty = false;
  let savedThisSession = false;
  let uploadBusy = false;

  const root = document.getElementById('editor-root');
  const loginView = document.getElementById('editor-login');
  const listView = document.getElementById('editor-list');
  const formView = document.getElementById('editor-form');
  const toastEl = document.getElementById('editor-toast');
  const dirtyEl = document.getElementById('editor-dirty');
  const draftBanner = document.getElementById('editor-draft-banner');

  function qs(id) {
    return document.getElementById(id);
  }

  function showToast(message, ok) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = 'editor-toast ' + (ok ? 'is-ok' : 'is-error');
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.hidden = true;
    }, 4000);
  }

  function setDirty(value) {
    dirty = value;
    if (dirtyEl) dirtyEl.hidden = !dirty;
    if (dirty) saveDraft();
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ when: Date.now(), items: items }));
    } catch (err) {
      /* sin localStorage: seguimos sin borrador */
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      /* nada */
    }
  }

  function blankItem() {
    return {
      titulo: 'Obra nueva',
      autor: null,
      imagen: '',
      audio: null,
      descripcion: '',
      categorias: ['Sin clasificar']
    };
  }

  /* ---------- Vistas ---------- */

  function show(view) {
    loginView.hidden = view !== 'login';
    listView.hidden = view !== 'list';
    formView.hidden = view !== 'form';
  }

  function openEditor() {
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    checkSession();
  }

  function closeEditor() {
    const finish = () => {
      root.hidden = true;
      document.body.style.overflow = '';
      if (savedThisSession) location.reload();
    };
    if (dirty) {
      if (confirm('Hay cambios sin guardar. ¿Salir de todos modos?')) finish();
      return;
    }
    finish();
  }

  function checkSession() {
    fetch('/api/session')
      .then((r) => r.json())
      .then((data) => {
        if (!data.enabled) {
          showLogin('El editor no está habilitado: falta configurar la contraseña en el servidor.');
          return;
        }
        if (data.authed) {
          enterEditor();
        } else {
          showLogin('');
        }
      })
      .catch(() => showLogin('No se pudo conectar con el servidor.'));
  }

  function showLogin(message) {
    show('login');
    const err = qs('login-error');
    if (err) {
      err.textContent = message || '';
      err.hidden = !message;
    }
    const pass = qs('login-pass');
    if (pass) pass.focus();
  }

  function enterEditor() {
    const draft = readDraft();
    if (draft && draftBanner) {
      draftBanner.hidden = false;
    }
    const saveBtn = qs('editor-save');
    if (saveBtn) saveBtn.disabled = false;
    loadCatalog();
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.items) && data.items.length > 0) return data;
      return null;
    } catch (err) {
      return null;
    }
  }

  function restoreDraft() {
    const draft = readDraft();
    if (!draft) return;
    items = draft.items;
    setDirty(true);
    if (draftBanner) draftBanner.hidden = true;
    renderRows();
    showToast('Borrador restaurado (' + items.length + ' obras). Recordá guardar.', true);
  }

  function discardDraft() {
    clearDraft();
    if (draftBanner) draftBanner.hidden = true;
    showToast('Borrador descartado.', true);
  }

  function loadCatalog() {
    fetch('/partituras.json?v=' + Date.now())
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        items = data;
        renderRows();
        show('list');
      })
      .catch(() => {
        showToast('No se pudo cargar el catálogo.', false);
        showLogin('');
      });
  }

  /* ---------- Lista de obras ---------- */

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function renderRows() {
    const box = qs('editor-rows');
    if (!box) return;
    const q = normalizeText(qs('editor-search').value);
    box.textContent = '';

    items.forEach((item, index) => {
      const hay = normalizeText(item.titulo + ' ' + (item.autor || ''));
      if (q && !hay.includes(q)) return;

      const row = document.createElement('div');
      row.className = 'editor-row';

      const thumb = document.createElement('img');
      thumb.className = 'editor-row-thumb';
      thumb.loading = 'lazy';
      thumb.alt = '';
      thumb.src = item.imagen || '';
      row.appendChild(thumb);

      const info = document.createElement('div');
      info.className = 'editor-row-info';
      const titleEl = document.createElement('div');
      titleEl.className = 'editor-row-title';
      titleEl.textContent = item.titulo || '(sin título)';
      info.appendChild(titleEl);
      const meta = document.createElement('div');
      meta.className = 'editor-row-meta';
      meta.textContent = (item.autor || 'sin autor') + ' · ' + (item.categorias || []).join(', ');
      info.appendChild(meta);
      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'editor-row-actions';

      const editBtn = mkBtn('Editar', 'editor-btn editor-btn-primary', () => openForm(index));
      const dupBtn = mkBtn('Duplicar', 'editor-btn', () => duplicateItem(index));
      const delBtn = mkBtn('Eliminar', 'editor-btn editor-btn-danger', () => deleteItem(index));
      actions.append(editBtn, dupBtn, delBtn);
      row.appendChild(actions);

      box.appendChild(row);
    });

    if (box.children.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'editor-empty';
      empty.textContent = 'Ninguna obra coincide con la búsqueda.';
      box.appendChild(empty);
    }
  }

  function mkBtn(label, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function duplicateItem(index) {
    const copy = JSON.parse(JSON.stringify(items[index]));
    copy.titulo = (copy.titulo || 'Obra') + ' (copia)';
    items.splice(index + 1, 0, copy);
    setDirty(true);
    renderRows();
    showToast('Obra duplicada. Ajustá sus datos antes de guardar.', true);
  }

  function buildCatCheckboxes() {
    const box = qs('f-cats');
    if (!box || box.children.length > 0) return;
    for (const cat of CATEGORIAS) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'f-cat-' + slugId(cat);
      input.value = cat;
      label.appendChild(input);
      label.appendChild(document.createTextNode(cat));
      box.appendChild(label);
    }
  }

  function deleteItem(index) {
    const item = items[index];
    if (!confirm('¿Eliminar «' + (item.titulo || 'sin título') + '» del catálogo?')) return false;
    items.splice(index, 1);
    setDirty(true);
    renderRows();
    return true;
  }

  /* ---------- Formulario de obra ---------- */

  function openForm(index) {
    editingIndex = index;
    const item = items[index];

    qs('form-heading').textContent = 'Editar: ' + (item.titulo || '(sin título)');
    qs('f-titulo').value = item.titulo || '';
    qs('f-autor').value = item.autor || '';
    qs('f-imagen').value = item.imagen || '';
    qs('f-audio').value = item.audio || '';
    qs('f-desc').value = item.descripcion || '';

    for (const cat of CATEGORIAS) {
      qs('f-cat-' + slugId(cat)).checked = (item.categorias || []).includes(cat);
    }

    updateImagePreview();
    updateAudioPreview();
    show('form');
  }

  function slugId(cat) {
    return normalizeText(cat).replace(/[^a-z0-9]+/g, '-');
  }

  function collectForm() {
    const categorias = [];
    for (const cat of CATEGORIAS) {
      if (qs('f-cat-' + slugId(cat)).checked) categorias.push(cat);
    }
    return {
      titulo: qs('f-titulo').value.trim(),
      autor: qs('f-autor').value.trim() || null,
      imagen: qs('f-imagen').value.trim(),
      audio: qs('f-audio').value.trim() || null,
      descripcion: qs('f-desc').value,
      categorias: categorias.length ? categorias : ['Sin clasificar']
    };
  }

  function applyForm() {
    items[editingIndex] = collectForm();
    setDirty(true);
    show('list');
    renderRows();
  }

  function updateImagePreview() {
    const value = qs('f-imagen').value.trim();
    const img = qs('f-img-preview');
    const warn = qs('f-img-warn');
    if (!value) {
      img.removeAttribute('src');
      img.hidden = true;
      warn.hidden = true;
      return;
    }
    img.hidden = false;
    img.src = value;
    warn.hidden = true;
  }

  function wireImagePreview() {
    const img = qs('f-img-preview');
    const warn = qs('f-img-warn');
    img.addEventListener('load', () => {
      warn.hidden = true;
    });
    img.addEventListener('error', () => {
      if (img.getAttribute('src')) {
        warn.textContent = 'No se ve esa imagen: revisá la ruta o subí el archivo.';
        warn.hidden = false;
      }
    });
  }

  function updateAudioPreview() {
    const value = qs('f-audio').value.trim();
    const audio = qs('f-audio-preview');
    audio.hidden = !value;
    if (value) {
      audio.src = value;
    } else {
      audio.removeAttribute('src');
      audio.load();
    }
  }

  /* ---------- Subida de archivos ---------- */

  function wireUpload(inputId, onPath) {
    const input = qs(inputId);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      if (uploadBusy) return;
      uploadBusy = true;
      showToast('Subiendo «' + file.name + '»…', true);
      fetch('/api/upload?name=' + encodeURIComponent(file.name), {
        method: 'POST',
        body: file
      })
        .then((r) => r.json())
        .then((data) => {
          uploadBusy = false;
          if (data.ok) {
            onPath(data.path);
            showToast('Archivo subido: ' + data.path, true);
            setDirty(true);
          } else {
            showToast(data.error || 'No se pudo subir el archivo.', false);
          }
        })
        .catch(() => {
          uploadBusy = false;
          showToast('Error de conexión al subir el archivo.', false);
        });
    });
  }

  /* ---------- Guardar todo ---------- */

  function saveAll() {
    // Validación amable del lado del editor
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const n = i + 1;
      if (!it.titulo || !it.titulo.trim()) {
        showToast('La obra n.º ' + n + ' no tiene título.', false);
        return;
      }
      if (!it.imagen || !/^imagenes\/[a-z0-9-]+\.(jpg|jpeg|png)$/.test(it.imagen)) {
        showToast('«' + it.titulo + '» no tiene una imagen válida (ej.: imagenes/mi-lamina.jpg).', false);
        return;
      }
      if (it.audio && !/^audios\/[a-z0-9-]+\.mp3$/.test(it.audio)) {
        showToast('El audio de «' + it.titulo + '» no es una ruta MP3 válida.', false);
        return;
      }
    }

    const btn = qs('editor-save');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    })
      .then((r) => r.json())
      .then((data) => {
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';
        if (data.ok) {
          savedThisSession = true;
          dirty = false;
          if (dirtyEl) dirtyEl.hidden = true;
          clearDraft();
          showToast('✓ Cambios guardados (' + data.count + ' obras).', true);
        } else if (data.error && /Sesión/.test(data.error)) {
          showLogin('Tu sesión venció. Ingresá la contraseña de nuevo.');
        } else {
          showToast(data.error || 'No se pudo guardar.', false);
        }
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';
        showToast('Error de conexión al guardar.', false);
      });
  }

  /* ---------- Cables ---------- */

  function wire() {
    qs('btn-editar').addEventListener('click', openEditor);
    qs('editor-exit').addEventListener('click', closeEditor);
    qs('login-cancel').addEventListener('click', () => {
      root.hidden = true;
      document.body.style.overflow = '';
    });

    qs('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: qs('login-pass').value })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            qs('login-pass').value = '';
            enterEditor();
          } else {
            showLogin(data.error || 'Contraseña incorrecta.');
          }
        })
        .catch(() => showLogin('No se pudo conectar con el servidor.'));
    });

    qs('editor-search').addEventListener('input', renderRows);
    qs('editor-add').addEventListener('click', () => {
      items.push(blankItem());
      setDirty(true);
      renderRows();
      openForm(items.length - 1);
    });

    qs('editor-back').addEventListener('click', () => {
      show('list');
      renderRows();
    });
    qs('form-apply').addEventListener('click', applyForm);
    qs('form-delete').addEventListener('click', () => {
      if (deleteItem(editingIndex)) show('list');
    });

    qs('f-imagen').addEventListener('input', updateImagePreview);
    qs('f-audio').addEventListener('input', updateAudioPreview);
    wireImagePreview();
    buildCatCheckboxes();

    wireUpload('f-img-file', (path) => {
      qs('f-imagen').value = path;
      updateImagePreview();
    });
    wireUpload('f-audio-file', (path) => {
      qs('f-audio').value = path;
      updateAudioPreview();
    });

    qs('editor-save').addEventListener('click', saveAll);

    qs('draft-restore').addEventListener('click', restoreDraft);
    qs('draft-discard').addEventListener('click', discardDraft);

    window.addEventListener('beforeunload', (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  wire();
})();
