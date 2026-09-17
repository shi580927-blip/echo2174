(() => {
  const STAGE_W = 1920;
  const STAGE_H = 1080;
  const CROP_W = 300;
  const CROP_H = 200;

  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');
  const sceneLayer = document.getElementById('sceneLayer');
  const sceneImage = document.getElementById('sceneImage');
  const topDrawer = document.getElementById('topDrawer');
  const topDrawerHandle = document.getElementById('topDrawerHandle');
  const dialogueDrawer = document.getElementById('dialogueDrawer');
  const dialogueHandle = document.getElementById('dialogueHandle');
  const inspectButton = document.getElementById('inspectButton');
  const inspectHint = document.getElementById('inspectHint');
  const inspectCursor = document.getElementById('inspectCursor');
  const cropPanel = document.getElementById('cropPanel');
  const cropCanvas = document.getElementById('cropCanvas');
  const observationTitle = document.getElementById('observationTitle');
  const journalList = document.getElementById('journalList');
  const versionList = document.getElementById('versionList');

  let data = { clueRegions: [], clues: {}, noiseResponses: [], versions: [] };
  let journal = load('echo2174.stage3.journal', []);
  let versionChecks = load('echo2174.stage3.versions', {});
  let inspecting = false;
  let pendingCrop = null;

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function persist() {
    localStorage.setItem('echo2174.stage3.journal', JSON.stringify(journal));
    localStorage.setItem('echo2174.stage3.versions', JSON.stringify(versionChecks));
  }

  function fitStage() {
    const scale = Math.min(viewport.clientWidth / STAGE_W, viewport.clientHeight / STAGE_H);
    stage.style.transform = `scale(${scale})`;
  }

  function showMessage(name, text) {
    document.getElementById('speakerName').textContent = name;
    document.getElementById('speakerText').textContent = text;
    dialogueDrawer.classList.remove('is-collapsed');
  }

  function closePanels() {
    document.querySelectorAll('.side-panel').forEach(p => p.hidden = true);
  }

  function openPanel(id) {
    closePanels();
    const panel = document.getElementById(id);
    if (panel) panel.hidden = false;
  }

  function setInspectMode(on) {
    inspecting = on;
    document.body.classList.toggle('inspecting', on);
    inspectButton.setAttribute('aria-pressed', String(on));
    inspectHint.hidden = !on;
    inspectCursor.hidden = true;
    if (!on) pendingCrop = null;
  }

  function virtualPoint(event) {
    const r = stage.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(STAGE_W, (event.clientX - r.left) / r.width * STAGE_W)),
      y: Math.max(0, Math.min(STAGE_H, (event.clientY - r.top) / r.height * STAGE_H))
    };
  }

  function chooseArea(point) {
    const halfW = CROP_W / 2;
    const halfH = CROP_H / 2;
    const cx = Math.max(halfW, Math.min(STAGE_W - halfW, point.x));
    const cy = Math.max(halfH, Math.min(STAGE_H - halfH, point.y));
    pendingCrop = { x: cx - halfW, y: cy - halfH, w: CROP_W, h: CROP_H };
    inspectCursor.style.left = `${cx}px`;
    inspectCursor.style.top = `${cy}px`;
    inspectCursor.hidden = false;
    observationTitle.value = '';
    drawCrop();
    cropPanel.hidden = false;
  }

  function drawCrop() {
    if (!pendingCrop) return;
    const ctx = cropCanvas.getContext('2d');
    const sx = pendingCrop.x / STAGE_W * sceneImage.naturalWidth;
    const sy = pendingCrop.y / STAGE_H * sceneImage.naturalHeight;
    const sw = pendingCrop.w / STAGE_W * sceneImage.naturalWidth;
    const sh = pendingCrop.h / STAGE_H * sceneImage.naturalHeight;
    ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.drawImage(sceneImage, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);
  }

  function makeThumb() {
    const c = document.createElement('canvas');
    c.width = 180; c.height = 120;
    c.getContext('2d').drawImage(cropCanvas, 0, 0, 180, 120);
    return c.toDataURL('image/jpeg', .72);
  }

  function score(crop, region) {
    const l = Math.max(crop.x, region.x);
    const t = Math.max(crop.y, region.y);
    const r = Math.min(crop.x + crop.w, region.x + region.w);
    const b = Math.min(crop.y + crop.h, region.y + region.h);
    if (r <= l || b <= t) return 0;
    const intersection = (r - l) * (b - t);
    const centerX = crop.x + crop.w / 2;
    const centerY = crop.y + crop.h / 2;
    const centerInside = centerX >= region.x && centerX <= region.x + region.w && centerY >= region.y && centerY <= region.y + region.h;
    return intersection / (crop.w * crop.h) + (centerInside ? 1 : 0);
  }

  function hiddenClueId(crop) {
    let best = null, bestScore = 0;
    data.clueRegions.forEach(region => {
      const s = score(crop, region);
      if (s > bestScore) { best = region; bestScore = s; }
    });
    return bestScore >= .22 && best ? best.id : null;
  }

  function saveObservation() {
    if (!pendingCrop) return;
    journal.push({
      id: `obs-${Date.now()}`,
      title: observationTitle.value.trim() || `Наблюдение ${journal.length + 1}`,
      crop: { ...pendingCrop },
      clueId: hiddenClueId(pendingCrop),
      thumb: makeThumb(),
      analysis: null
    });
    persist();
    renderJournal();
    renderVersions();
    cancelCrop(true);
    showMessage('Аркадий:', 'Наблюдение сохранено. То, что вы его заметили, ещё не превращает его в доказательство.');
  }

  function analyzeObservation(id) {
    const item = journal.find(x => x.id === id);
    if (!item) return;
    const clue = item.clueId ? data.clues[item.clueId] : null;
    if (clue) {
      item.analysis = { status: clue.status, label: clue.label, result: clue.fact };
      showMessage('Аркадий:', clue.arcady);
    } else {
      const pool = data.noiseResponses || [];
      const result = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'Связь с делом не подтверждена.';
      item.analysis = { status: 'noise', label: 'Не подтверждено', result };
      showMessage('Аркадий:', 'Объект существует. Это максимум, что я готов сейчас о нём утверждать.');
    }
    persist();
    renderJournal();
    renderVersions();
  }

  function analyzedIds() {
    return new Set(journal.filter(x => x.analysis && x.clueId).map(x => x.clueId));
  }

  function verifyVersion(version) {
    versionChecks[version.id] = { outcome: version.outcome, result: version.verificationResult };
    persist();
    renderVersions();
    showMessage('Аркадий:', version.arcady);
  }

  function renderVersions() {
    versionList.innerHTML = '';
    const ids = analyzedIds();
    const available = (data.versions || []).filter(v => (v.requires || []).every(id => ids.has(id)));
    if (!available.length) {
      const p = document.createElement('p');
      p.className = 'panel-note';
      p.textContent = 'Пока данных недостаточно, чтобы сформулировать проверяемую версию.';
      versionList.appendChild(p);
      return;
    }
    available.forEach(v => {
      const card = document.createElement('article');
      card.className = 'version-card';
      const h = document.createElement('h4'); h.textContent = v.title;
      const p = document.createElement('p'); p.textContent = v.consequence;
      card.append(h, p);
      const done = versionChecks[v.id];
      if (!done) {
        const b = document.createElement('button');
        b.className = 'version-check'; b.textContent = v.verificationLabel;
        b.addEventListener('click', e => { e.stopPropagation(); verifyVersion(v); });
        card.appendChild(b);
      } else {
        const r = document.createElement('div');
        r.className = `version-result ${done.outcome}`; r.textContent = done.result;
        card.appendChild(r);
      }
      versionList.appendChild(card);
    });
  }

  function renderJournal() {
    journalList.innerHTML = '';
    if (!journal.length) {
      const p = document.createElement('p'); p.className = 'panel-note'; p.textContent = 'Пока нет сохранённых наблюдений.';
      journalList.appendChild(p); return;
    }
    [...journal].reverse().forEach(item => {
      const card = document.createElement('article'); card.className = 'journal-item';
      const img = document.createElement('img'); img.className = 'journal-thumb'; img.alt = ''; img.src = item.thumb || '';
      const copy = document.createElement('div'); copy.className = 'journal-copy';
      const title = document.createElement('strong'); title.textContent = item.title;
      const status = document.createElement('span'); status.className = `journal-status ${item.analysis?.status || 'observation'}`; status.textContent = item.analysis?.label || 'Наблюдение';
      copy.append(title, status);
      if (!item.analysis) {
        const b = document.createElement('button'); b.className = 'journal-action'; b.textContent = 'Отправить Аркадию';
        b.addEventListener('click', e => { e.stopPropagation(); analyzeObservation(item.id); });
        copy.appendChild(b);
      } else {
        const r = document.createElement('div'); r.className = 'journal-result'; r.textContent = item.analysis.result; copy.appendChild(r);
      }
      card.append(img, copy); journalList.appendChild(card);
    });
  }

  function cancelCrop(exitInspect) {
    cropPanel.hidden = true;
    pendingCrop = null;
    inspectCursor.hidden = true;
    observationTitle.value = '';
    if (exitInspect) setInspectMode(false);
  }

  async function init() {
    fitStage();
    const parts = window.ECHO_SCENE_PARTS || [];
    if (parts.length) sceneImage.src = 'data:image/webp;base64,' + parts.join('');
    data = await fetch('data/stage3.json', { cache: 'no-store' }).then(r => r.json());
    renderJournal();
    renderVersions();
  }

  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', () => setTimeout(fitStage, 100));

  topDrawerHandle.addEventListener('click', e => {
    e.stopPropagation();
    topDrawer.classList.toggle('is-collapsed');
    topDrawerHandle.textContent = topDrawer.classList.contains('is-collapsed') ? '◀' : '▶';
  });
  dialogueHandle.addEventListener('click', e => { e.stopPropagation(); dialogueDrawer.classList.toggle('is-collapsed'); });

  document.querySelectorAll('.nav-button').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); openPanel(b.dataset.panel); }));
  document.querySelectorAll('[data-close-panel]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); closePanels(); }));

  inspectButton.addEventListener('click', e => {
    e.stopPropagation(); closePanels(); setInspectMode(!inspecting);
  });
  sceneLayer.addEventListener('click', e => {
    if (!inspecting || !cropPanel.hidden) return;
    chooseArea(virtualPoint(e));
  });

  document.getElementById('saveObservation').addEventListener('click', saveObservation);
  document.getElementById('retryObservation').addEventListener('click', () => cancelCrop(false));
  document.getElementById('cancelObservation').addEventListener('click', () => cancelCrop(true));
  document.getElementById('cancelObservationTop').addEventListener('click', () => cancelCrop(true));
  document.getElementById('resetJournal').addEventListener('click', () => {
    journal = []; versionChecks = {}; persist(); renderJournal(); renderVersions();
    showMessage('Аркадий:', 'Журнал очищен. Память человечества снова в безопасности.');
  });

  stage.addEventListener('click', e => {
    if (e.target.closest('button,input,.side-panel,.crop-panel')) return;
    closePanels();
    if (!inspecting) {
      topDrawer.classList.add('is-collapsed'); topDrawerHandle.textContent = '◀';
      dialogueDrawer.classList.add('is-collapsed');
    }
  });

  init();
})();
