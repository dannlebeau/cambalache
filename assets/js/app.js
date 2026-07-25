// Lógica de index.html: consulta en vivo las APIs de YGOPRODeck (Yu-Gi-Oh!) y Pokémon TCG
// API, más el catálogo de ejemplo de Mitos y Leyendas (assets/js/myl-data.js). Ordena por ID,
// permite agregar cartas al canasto (assets/js/shared.js), hacer zoom a la imagen y traducir
// la descripción al español con la API pública de MyMemory.

const TYPE_OPTIONS = {
  ygo: ['Effect Monster', 'Normal Monster', 'Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster', 'Ritual Monster', 'Spell Card', 'Trap Card'],
  poke: ['Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'],
  myl: [...new Set(MYL_CARDS.map((c) => c.mitologia))],
};

const state = {
  game: 'ygo',
  query: '',
  type: '',
  offset: 0,
  page: 1,
  items: [],
  total: 0,
  hasMore: true,
  loading: false,
};

let currentModalCard = null;
const translationCache = {}; // { [cardId]: textoTraducido }

// ---- Normalización por juego ----

function normalizeYgo(c) {
  return {
    id: 'ygo-' + c.id,
    juego: 'ygo',
    nombre: c.name,
    imagen: c.card_images?.[0]?.image_url_small || '',
    imagenGrande: c.card_images?.[0]?.image_url || '',
    descripcion: c.desc || '(Sin descripción)',
    idiomaOriginal: 'en',
    meta: [
      { k: 'Tipo', v: c.type },
      c.race ? { k: 'Raza/Clase', v: c.race } : null,
      c.attribute ? { k: 'Atributo', v: c.attribute } : null,
      (c.atk !== undefined && c.atk !== null) ? { k: 'ATK', v: String(c.atk) } : null,
      (c.def !== undefined && c.def !== null) ? { k: 'DEF', v: String(c.def) } : null,
      c.level ? { k: 'Nivel', v: String(c.level) } : null,
    ].filter(Boolean),
  };
}

function normalizePoke(c) {
  return {
    id: 'poke-' + c.id,
    juego: 'poke',
    nombre: c.name,
    imagen: c.images?.small || '',
    imagenGrande: c.images?.large || c.images?.small || '',
    descripcion: c.flavorText || '(Esta carta no tiene texto descriptivo en la API)',
    idiomaOriginal: 'en',
    meta: [
      c.supertype ? { k: 'Tipo', v: c.supertype } : null,
      (c.types && c.types.length) ? { k: 'Elemento', v: c.types.join(', ') } : null,
      c.hp ? { k: 'HP', v: c.hp } : null,
      c.set?.name ? { k: 'Set', v: c.set.name } : null,
      c.rarity ? { k: 'Rareza', v: c.rarity } : null,
    ].filter(Boolean),
  };
}

function normalizeMyl(c) {
  return {
    id: c.id,
    juego: 'myl',
    nombre: c.nombre,
    imagen: '',
    imagenGrande: '',
    descripcion: c.descripcion,
    idiomaOriginal: 'es',
    meta: [{ k: 'Mitología', v: c.mitologia }],
  };
}

// ---- Fetch por juego (ordenado por ID) ----

async function fetchYgo() {
  const params = new URLSearchParams();
  params.set('num', '24');
  params.set('offset', String(state.offset));
  params.set('sort', 'id');
  if (state.query) params.set('fname', state.query);
  if (state.type) params.set('type', state.type);

  const resp = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${params}`);
  if (!resp.ok) {
    if (resp.status === 400) return { items: [], total: 0 };
    throw new Error('Error de red consultando Yu-Gi-Oh!');
  }
  const data = await resp.json();
  return {
    items: (data.data || []).map(normalizeYgo),
    total: data.meta ? data.meta.total_rows : (data.data || []).length,
  };
}

async function fetchPoke() {
  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('pageSize', '24');
  params.set('orderBy', 'id');
  const qParts = [];
  if (state.query) qParts.push(`name:${state.query}*`);
  if (state.type) qParts.push(`types:${state.type}`);
  if (qParts.length) params.set('q', qParts.join(' '));

  const resp = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`);
  if (!resp.ok) throw new Error('Error de red consultando Pokémon');
  const data = await resp.json();
  return {
    items: (data.data || []).map(normalizePoke),
    total: data.totalCount || 0,
  };
}

function loadMylLocal() {
  const q = state.query.trim().toLowerCase();
  const list = MYL_CARDS
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((c) =>
      (!q || c.nombre.toLowerCase().includes(q)) &&
      (!state.type || c.mitologia === state.type)
    );
  return { items: list.map(normalizeMyl), total: list.length };
}

// ---- Carga y render de la grilla ----

function populateTypeFilter(game) {
  const sel = document.getElementById('typeFilter');
  const opts = TYPE_OPTIONS[game] || [];
  sel.innerHTML = '<option value="">Todos los tipos</option>' + opts.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
  sel.value = '';
  state.type = '';
}

function showStateMsg(kind) {
  const el = document.getElementById('stateMsg');
  if (kind === 'loading') {
    el.innerHTML = '<p class="empty-state"><i class="fas fa-spinner fa-spin"></i>Cargando cartas…</p>';
  } else if (kind === 'empty') {
    el.innerHTML = '<p class="empty-state"><i class="fas fa-magnifying-glass"></i>No encontramos cartas con esa búsqueda.</p>';
  } else if (kind === 'error') {
    el.innerHTML = '<p class="error-state"><i class="fas fa-triangle-exclamation"></i>No pudimos consultar la API en este momento. Intenta de nuevo en unos segundos.</p>';
  }
}

function clearStateMsg() {
  document.getElementById('stateMsg').innerHTML = '';
}

function updateResultsNote() {
  const el = document.getElementById('resultsNote');
  if (state.game === 'myl') {
    el.textContent = `${state.total} carta(s) de ejemplo, sin API pública oficial (ver "Acerca de") · orden por ID`;
  } else {
    const totalFmt = (state.total || 0).toLocaleString('es-CL');
    el.textContent = `Mostrando ${state.items.length.toLocaleString('es-CL')} de ${totalFmt} cartas · orden por ID`;
  }
}

function updateLoadMoreBtn() {
  const wrap = document.getElementById('loadMoreWrap');
  const btn = document.getElementById('loadMoreBtn');
  wrap.style.display = state.hasMore ? 'block' : 'none';
  btn.disabled = state.loading;
  btn.innerHTML = state.loading ? '<i class="fas fa-spinner fa-spin"></i> Cargando…' : '<i class="fas fa-plus"></i> Cargar más cartas';
}

function cardTileHtml(card) {
  const meta = GAME_META[card.juego];
  const inList = isInCanasto(card.id);
  return `
    <div class="tcard" data-id="${escapeHtml(card.id)}">
      <div class="tcard-visual">
        <i class="fas fa-images"></i>
        ${card.imagen ? `<img src="${escapeHtml(card.imagen)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <span class="tcard-chip" style="background:${meta.color}">${meta.short}</span>
      </div>
      <div class="tcard-body">
        <h4>${escapeHtml(card.nombre)}</h4>
        <button class="tcard-add ${inList ? 'added' : ''}" data-id="${escapeHtml(card.id)}">
          <i class="fas ${inList ? 'fa-check' : 'fa-basket-shopping'}"></i> ${inList ? 'En tu canasto' : 'Agregar al canasto'}
        </button>
      </div>
    </div>`;
}

function renderCards(list, append) {
  const grid = document.getElementById('cardGrid');
  if (!append) grid.innerHTML = '';
  grid.insertAdjacentHTML('beforeend', list.map(cardTileHtml).join(''));
}

async function loadPage(opts) {
  const reset = !!(opts && opts.reset);
  if (state.loading) return;

  if (reset) {
    state.items = [];
    state.offset = 0;
    state.page = 1;
    state.hasMore = true;
    document.getElementById('cardGrid').innerHTML = '';
    clearStateMsg();
  }
  if (!state.hasMore) return;

  state.loading = true;
  updateLoadMoreBtn();
  if (state.items.length === 0) showStateMsg('loading');

  try {
    let result;
    if (state.game === 'ygo') result = await fetchYgo();
    else if (state.game === 'poke') result = await fetchPoke();
    else result = loadMylLocal();

    state.items = state.items.concat(result.items);
    state.total = result.total;
    renderCards(result.items, true);

    if (state.game === 'ygo') {
      state.offset += result.items.length;
      state.hasMore = result.items.length > 0 && state.items.length < state.total;
    } else if (state.game === 'poke') {
      state.page += 1;
      state.hasMore = state.items.length < state.total;
    } else {
      state.hasMore = false;
    }

    clearStateMsg();
    if (state.items.length === 0) showStateMsg('empty');
    updateResultsNote();
  } catch (err) {
    console.error(err);
    if (state.items.length === 0) showStateMsg('error');
  } finally {
    state.loading = false;
    updateLoadMoreBtn();
  }
}

// ---- Modal de detalle, zoom y traducción ----

function refreshModalAddBtn() {
  const btn = document.getElementById('modalAddBtn');
  if (!btn || !currentModalCard) return;
  const inList = isInCanasto(currentModalCard.id);
  btn.innerHTML = `<i class="fas ${inList ? 'fa-check' : 'fa-basket-shopping'}"></i> ${inList ? 'Ya está en tu canasto' : 'Agregar al canasto'}`;
}

function renderModalDesc(texto) {
  document.getElementById('modalDesc').textContent = texto;
}

function openModal(card) {
  currentModalCard = card;
  const meta = GAME_META[card.juego];
  const img = card.imagenGrande || card.imagen;

  document.getElementById('modalVisual').innerHTML = img
    ? `<img src="${escapeHtml(img)}" alt="" id="modalImg" onerror="this.remove()">`
    : '<i class="fas fa-images"></i>';

  const chipEl = document.getElementById('modalChip');
  chipEl.textContent = meta.label;
  chipEl.style.background = meta.color;
  chipEl.style.color = '#fff';

  document.getElementById('modalNombre').textContent = card.nombre;
  document.getElementById('modalMeta').innerHTML = card.meta.map((m) => `<span><strong>${escapeHtml(m.k)}:</strong> ${escapeHtml(m.v)}</span>`).join('');
  renderModalDesc(card.descripcion);

  const translateBtn = document.getElementById('translateBtn');
  if (card.idiomaOriginal === 'en') {
    translateBtn.style.display = 'inline-flex';
    translateBtn.disabled = false;
    translateBtn.innerHTML = translationCache[card.id]
      ? '<i class="fas fa-rotate-left"></i> Ver original (inglés)'
      : '<i class="fas fa-language"></i> Traducir al español';
    translateBtn.dataset.showingTranslation = translationCache[card.id] ? 'true' : 'false';
  } else {
    translateBtn.style.display = 'none';
  }

  refreshModalAddBtn();
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

async function handleTranslateClick() {
  const btn = document.getElementById('translateBtn');
  if (!currentModalCard) return;
  const card = currentModalCard;

  if (btn.dataset.showingTranslation === 'true') {
    renderModalDesc(card.descripcion);
    btn.dataset.showingTranslation = 'false';
    btn.innerHTML = '<i class="fas fa-language"></i> Traducir al español';
    return;
  }

  if (translationCache[card.id]) {
    renderModalDesc(translationCache[card.id]);
    btn.dataset.showingTranslation = 'true';
    btn.innerHTML = '<i class="fas fa-rotate-left"></i> Ver original (inglés)';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traduciendo…';
  try {
    const texto = card.descripcion.slice(0, 480); // límite razonable de la API gratuita
    const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|es`);
    if (!resp.ok) throw new Error('Error de red al traducir');
    const data = await resp.json();
    const traducido = data?.responseData?.translatedText;
    if (!traducido) throw new Error('Sin traducción disponible');

    translationCache[card.id] = traducido + '\n\n(traducción automática, puede tener errores)';
    renderModalDesc(translationCache[card.id]);
    btn.dataset.showingTranslation = 'true';
    btn.innerHTML = '<i class="fas fa-rotate-left"></i> Ver original (inglés)';
  } catch (err) {
    console.error(err);
    btn.innerHTML = '<i class="fas fa-triangle-exclamation"></i> No se pudo traducir';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-language"></i> Traducir al español'; }, 2200);
  } finally {
    btn.disabled = false;
  }
}

function openZoom() {
  const img = document.getElementById('modalImg');
  if (!img) return;
  document.getElementById('zoomImg').src = img.src;
  document.getElementById('zoomOverlay').classList.add('open');
}

function closeZoom() {
  document.getElementById('zoomOverlay').classList.remove('open');
}

// ---- Arranque ----

document.addEventListener('DOMContentLoaded', () => {
  populateTypeFilter(state.game);
  updateCanastoBadge();
  loadPage({ reset: true });

  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.game = btn.dataset.game;
    document.getElementById('searchInput').value = '';
    state.query = '';
    populateTypeFilter(state.game);
    loadPage({ reset: true });
  });

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = e.target.value.trim();
      loadPage({ reset: true });
    }, 350);
  });

  document.getElementById('typeFilter').addEventListener('change', (e) => {
    state.type = e.target.value;
    loadPage({ reset: true });
  });

  document.getElementById('loadMoreBtn').addEventListener('click', () => loadPage({ reset: false }));

  document.getElementById('cardGrid').addEventListener('click', (e) => {
    const addBtn = e.target.closest('.tcard-add');
    const cardEl = e.target.closest('.tcard');
    if (!cardEl) return;
    const id = cardEl.dataset.id;
    const card = state.items.find((c) => c.id === id);
    if (!card) return;
    if (addBtn) {
      if (!isInCanasto(id)) addToCanasto(card);
      const inList = isInCanasto(id);
      addBtn.classList.toggle('added', inList);
      addBtn.innerHTML = `<i class="fas ${inList ? 'fa-check' : 'fa-basket-shopping'}"></i> ${inList ? 'En tu canasto' : 'Agregar al canasto'}`;
    } else {
      openModal(card);
    }
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.getElementById('modalAddBtn').addEventListener('click', () => {
    if (!currentModalCard) return;
    if (!isInCanasto(currentModalCard.id)) addToCanasto(currentModalCard);
    refreshModalAddBtn();
  });
  document.getElementById('translateBtn').addEventListener('click', handleTranslateClick);

  document.getElementById('modalVisual').addEventListener('click', (e) => {
    if (e.target.id === 'modalImg') openZoom();
  });
  document.getElementById('zoomOverlay').addEventListener('click', closeZoom);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeZoom(); closeModal(); }
  });
});
