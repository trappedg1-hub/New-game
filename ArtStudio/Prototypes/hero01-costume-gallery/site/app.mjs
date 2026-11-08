import { art, artById, artUrl, motions, motionById } from './catalog-data.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const tabs = ['animation', 'still', 'pending'];
const verdictLabels = { keep: 'Оставить', improve: 'Доработать', redo: 'Переделать' };
const storeKey = 'hero01-costume-review-v1';
let reviews = {};
let storageAvailable = true;
let reviewKey = null;
let selectedArtId = null;
let artChoices = [];
let activeMotion = null;
let activeVariant = null;

try {
  const value = JSON.parse(localStorage.getItem(storeKey) || '{}');
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if ((key.startsWith('art/') || key.startsWith('motion/')) && entry && typeof entry === 'object') {
        const verdict = Object.hasOwn(verdictLabels, entry.verdict) ? entry.verdict : '';
        const note = typeof entry.note === 'string' ? entry.note.slice(0, 3000) : '';
        if (verdict || note.trim()) reviews[key] = { verdict, note };
      }
    }
  }
} catch { storageAvailable = false; }

function reviewName(key) {
  const [kind, id, variantId] = key.split('/');
  if (kind === 'art' && artById[id]) return `${artById[id].title} · арт`;
  const motion = kind === 'motion' && motionById[id];
  const variant = motion && motion.variants.find(item => item.id === variantId);
  return variant ? `${motion.title} · ${variant.label}` : key;
}

function persistReviews() {
  try { localStorage.setItem(storeKey, JSON.stringify(reviews)); }
  catch { storageAvailable = false; }
  $('#storage-notice').textContent = storageAvailable
    ? 'Заметка сохранится только в этом браузере. Чтобы я её увидел, скопируй и отправь мне.'
    : 'Автосохранение недоступно. Заметки хранятся только до закрытия страницы — скопируй их сейчас.';
  refreshReviewMarkers();
}

function refreshReviewMarkers() {
  $('#notes-count').textContent = String(Object.keys(reviews).length);
  $$('[data-chip]').forEach(element => {
    const entry = reviews[element.dataset.chip];
    element.textContent = entry ? (verdictLabels[entry.verdict] || 'Есть заметка') : '';
  });
  if (activeMotion && activeVariant) {
    const entry = reviews[`motion/${activeMotion.id}/${activeVariant.id}`];
    $('#viewer-review-status').textContent = entry ? `Твоя оценка: ${verdictLabels[entry.verdict] || 'есть заметка'}` : '';
  }
}

function cardImage(item, type) {
  return `<button type="button" class="card-image-button" data-open-art="${escapeHtml(item.id)}" aria-label="Открыть арт: ${escapeHtml(item.title)}">
    <span class="card-image"><picture><source srcset="./thumb/${escapeHtml(item.id)}.webp" type="image/webp"><img src="${escapeHtml(artUrl(item))}" alt="${escapeHtml(item.title)}" loading="${type === 'MOTION STUDY' ? 'eager' : 'lazy'}" decoding="async"></picture></span>
    <span class="image-topline"><span>${escapeHtml(type)}</span><span>${escapeHtml(item.number)} / HERO</span></span><span class="image-expand" aria-hidden="true">↗</span>
  </button>`;
}

function motionCard(motion) {
  const item = artById[motion.art];
  const key = `motion/${motion.id}/${motion.variants[0].id}`;
  return `<article class="card" data-motion-card="${escapeHtml(motion.id)}">
    ${cardImage(item, 'MOTION STUDY')}
    <div class="card-body"><div class="card-overline"><span>${escapeHtml(motion.english)}</span><span>${escapeHtml(motion.meta)}</span></div>
      <h3>${escapeHtml(motion.title)}</h3><p class="card-description">${escapeHtml(motion.description)}</p>
      <div class="card-actions"><button type="button" class="button button-primary" data-view="${escapeHtml(motion.id)}">Смотреть анимацию <span>↗</span></button><button type="button" class="button button-secondary" data-review="${escapeHtml(key)}" aria-label="Оценить: ${escapeHtml(motion.title)}">✳</button></div>
      <div class="card-meta-row"><span>${escapeHtml(motion.badge)}</span><span class="review-chip" data-chip="${escapeHtml(key)}"></span></div>
      <div class="card-meta-row"><button type="button" class="link-button" data-open-art="${escapeHtml(item.id)}" data-art-set="${escapeHtml(motion.arts.join(','))}">${motion.arts.length > 1 ? 'Посмотреть два оригинала' : 'Посмотреть оригинал'}</button><span>${item.width} × ${item.height}</span></div>
    </div></article>`;
}

function stillCard(item) {
  const key = `art/${item.id}`;
  const pending = item.group === 'pending';
  return `<article class="card" data-art-card="${escapeHtml(item.id)}">
    ${cardImage(item, pending ? 'НУЖНО УТОЧНИТЬ' : 'APPROVED ART')}
    <div class="card-body"><div class="card-overline"><span>${escapeHtml(item.english)}</span><span>${pending ? 'НА УТОЧНЕНИИ' : 'БЕЗ АНИМАЦИИ'}</span></div>
      <h3>${escapeHtml(item.title)}</h3><p class="card-description">${escapeHtml(item.description)}</p>
      <div class="card-actions"><button type="button" class="button button-primary" data-open-art="${escapeHtml(item.id)}">Посмотреть арт <span>↗</span></button><button type="button" class="button button-secondary" data-review="${escapeHtml(key)}" aria-label="Оценить: ${escapeHtml(item.title)}">✳</button></div>
      <div class="card-meta-row"><span>${item.width} × ${item.height}</span><span class="review-chip" data-chip="${escapeHtml(key)}"></span></div>
    </div></article>`;
}

$('#motion-grid').innerHTML = motions.map(motionCard).join('');
$('#still-grid').innerHTML = art.filter(item => item.group === 'still').map(stillCard).join('');
$('#pending-grid').innerHTML = art.filter(item => item.group === 'pending').map(stillCard).join('');

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}
function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog.open) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function showTab(tab) {
  const selected = tabs.includes(tab) ? tab : 'animation';
  const wasViewer = !$('#viewer').hidden;
  $('#home').hidden = false;
  $('#viewer').hidden = true;
  if (wasViewer) {
    $('#preview-frame').src = 'about:blank';
    activeMotion = null;
    activeVariant = null;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  for (const name of tabs) {
    const button = $(`#tab-${name}`);
    const active = name === selected;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    $(`#panel-${name}`).hidden = !active;
  }
}

function showMotion(motionId, variantId) {
  const motion = motionById[motionId];
  if (!motion) { showTab('animation'); return; }
  const variant = motion.variants.find(item => item.id === variantId) || motion.variants[0];
  const wasViewer = !$('#viewer').hidden;
  const previousPath = activeVariant?.path;
  activeMotion = motion;
  activeVariant = variant;
  $('#home').hidden = true;
  $('#viewer').hidden = false;
  $('#viewer-index').textContent = `HERO-01 / MOTION ${motion.number}`;
  $('#viewer-kicker').textContent = `${motion.english} / ${variant.label}`;
  $('#viewer-title').innerHTML = `${escapeHtml(motion.title)} <em>${escapeHtml(variant.label)}</em>`;
  $('#viewer-description').textContent = motion.description;
  $('#viewer-badge').textContent = variant.verdict;
  $('#variant-detail').textContent = variant.detail;
  $('#variant-note').textContent = variant.note;
  $('#version-row').hidden = motion.variants.length < 2;
  $('#version-buttons').innerHTML = motion.variants.map(item => `<button type="button" data-version="${escapeHtml(item.id)}" aria-pressed="${String(item.id === variant.id)}">${escapeHtml(item.label)}</button>`).join('');
  $('#viewer-art-links').innerHTML = motion.arts.map(id => `<button type="button" data-open-art="${escapeHtml(id)}" data-art-set="${escapeHtml(motion.arts.join(','))}">${escapeHtml(artById[id].title)} ↗</button>`).join('');
  $('#open-direct').href = variant.path;
  $('#preview-frame').title = `Анимация ${motion.title}, ${variant.label}`;
  if (!wasViewer || previousPath !== variant.path) $('#preview-frame').src = variant.path;
  $('#review-motion').dataset.review = `motion/${motion.id}/${variant.id}`;
  refreshReviewMarkers();
  if (!wasViewer) window.scrollTo({ top: 0, behavior: 'instant' });
}

function route() {
  const parts = location.hash.slice(1).split('/');
  if (parts[0] === 'motion') showMotion(parts[1], parts[2]);
  else showTab(parts[0]);
}

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function showArt(id, ids = [id]) {
  const item = artById[id];
  if (!item) return;
  selectedArtId = id;
  artChoices = ids.filter(candidate => artById[candidate]);
  if (!artChoices.includes(id)) artChoices.unshift(id);
  $('#art-dialog-kicker').textContent = item.english;
  $('#art-dialog-title').textContent = item.title;
  $('#art-dialog-status').textContent = item.status;
  $('#art-dialog-description').textContent = item.description;
  $('#art-dialog-dimensions').textContent = `Оригинал PNG · ${item.width} × ${item.height} · без изменения разрешения`;
  $('#art-full-image').src = artUrl(item);
  $('#art-full-image').alt = `${item.title} — ${item.status.toLowerCase()}`;
  $('#open-original').href = artUrl(item);
  $('#art-viewport').classList.remove('zoomed');
  $('#art-viewport').scrollTop = 0;
  $('#art-viewport').scrollLeft = 0;
  $('#toggle-zoom').innerHTML = 'Увеличить <span>＋</span>';
  $('#art-switcher').hidden = artChoices.length < 2;
  $('#art-switcher').innerHTML = artChoices.map(choice => `<button type="button" data-art-choice="${escapeHtml(choice)}" aria-pressed="${String(choice === id)}">${escapeHtml(artById[choice].title)}</button>`).join('');
  $('#review-art').dataset.review = `art/${id}`;
  openDialog('art-dialog');
}

function syncReviewDialog() {
  const entry = reviews[reviewKey] || { verdict: '', note: '' };
  $('#review-title').textContent = reviewName(reviewKey);
  $('#review-note').value = entry.note;
  $$('[data-verdict]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.verdict === entry.verdict)));
}
function showReview(key) {
  if (!key || reviewName(key) === key) return;
  reviewKey = key;
  syncReviewDialog();
  $('#storage-notice').textContent = storageAvailable
    ? 'Заметка сохранится только в этом браузере. Чтобы я её увидел, скопируй и отправь мне.'
    : 'Автосохранение недоступно. Заметки хранятся только до закрытия страницы — скопируй их сейчас.';
  openDialog('review-dialog');
}
function saveReview(verdict, note) {
  if (verdict || note.trim()) reviews[reviewKey] = { verdict, note };
  else delete reviews[reviewKey];
  persistReviews();
}

function reviewEntries() {
  return Object.entries(reviews).filter(([key]) => reviewName(key) !== key);
}
function reportText() {
  const entries = reviewEntries();
  return ['HERO-01 — мои оценки', '', ...entries.map(([key, value]) => {
    const verdict = verdictLabels[value.verdict] || 'Без решения';
    const note = value.note.trim();
    return `• ${reviewName(key)}: ${verdict}${note ? `\n  ${note.replace(/\n/g, '\n  ')}` : ''}`;
  })].join('\n');
}
function showSummary() {
  const list = $('#review-list');
  list.replaceChildren();
  const entries = reviewEntries();
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'review-empty';
    empty.textContent = 'Здесь появятся твои оценки и замечания.';
    list.append(empty);
  }
  for (const [key, entry] of entries) {
    const row = document.createElement('div');
    row.className = 'review-entry';
    const top = document.createElement('div');
    top.className = 'review-entry-top';
    const title = document.createElement('strong');
    title.textContent = reviewName(key);
    const verdict = document.createElement('span');
    verdict.textContent = verdictLabels[entry.verdict] || 'Есть заметка';
    top.append(title, verdict);
    row.append(top);
    if (entry.note.trim()) {
      const note = document.createElement('p');
      note.textContent = entry.note;
      row.append(note);
    }
    list.append(row);
  }
  $('#copy-reviews').disabled = entries.length === 0;
  $('#download-reviews').disabled = entries.length === 0;
  $('#copy-status').textContent = '';
  openDialog('summary-dialog');
}

async function copyReport() {
  const text = reportText();
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(text);
    $('#copy-status').textContent = 'Скопировано. Теперь можно отправить заметки в чат.';
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-10000px;top:0';
    document.body.append(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Download remains available. */ }
    area.remove();
    $('#copy-status').textContent = copied ? 'Скопировано. Теперь можно отправить заметки в чат.' : 'Не получилось скопировать. Используй кнопку «Скачать .txt».';
  }
}

$('#review-note').addEventListener('input', event => saveReview(reviews[reviewKey]?.verdict || '', event.target.value));
$('#clear-review').addEventListener('click', () => { delete reviews[reviewKey]; persistReviews(); syncReviewDialog(); });
$('#open-summary').addEventListener('click', showSummary);
$('#copy-reviews').addEventListener('click', copyReport);
$('#download-reviews').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([reportText()], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'hero01-review.txt';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('#copy-status').textContent = 'Файл скачан. Его можно отправить мне.';
});
$('#toggle-zoom').addEventListener('click', () => {
  const zoomed = $('#art-viewport').classList.toggle('zoomed');
  $('#toggle-zoom').innerHTML = zoomed ? 'Вписать <span>−</span>' : 'Увеличить <span>＋</span>';
});
$('#back-to-collection').addEventListener('click', () => navigate('#animation'));
window.addEventListener('hashchange', route);

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.close) closeDialog(button.dataset.close);
  else if (button.dataset.tab) navigate(`#${button.dataset.tab}`);
  else if (button.dataset.view) navigate(`#motion/${button.dataset.view}/${motionById[button.dataset.view].variants[0].id}`);
  else if (button.dataset.version && activeMotion) navigate(`#motion/${activeMotion.id}/${button.dataset.version}`);
  else if (button.dataset.openArt) showArt(button.dataset.openArt, button.dataset.artSet?.split(',') || [button.dataset.openArt]);
  else if (button.dataset.artChoice) showArt(button.dataset.artChoice, artChoices);
  else if (button.dataset.review) showReview(button.dataset.review);
  else if (button.dataset.verdict && reviewKey) {
    saveReview(button.dataset.verdict, $('#review-note').value);
    syncReviewDialog();
  }
});

$('.tab-bar').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const current = tabs.indexOf(document.activeElement.dataset.tab);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  navigate(`#${tabs[next]}`);
  $(`#tab-${tabs[next]}`).focus();
});

route();
refreshReviewMarkers();
