(() => {
  const F = window.MediaPullFormat;
  const api = window.mediaPullAPI || null;
  const SITE_URL = 'https://media-pull.vercel.app/';
  const STORE_URL_FALLBACK = 'https://earslaner2001.gumroad.com/l/mediapull-pro';
  const LOG_VISIBLE_KEY = 'mediapull-log-visible';
  const FORMAT_KEY = 'mediapull-format';
  const START_LABEL = 'İndirmeyi Başlat';

  const PHASE_LABELS = {
    analyzing: 'Analiz ediliyor...',
    downloading: 'Video verisi alınıyor...',
    merging: 'Video ve ses birleştiriliyor...',
    converting: 'H.264 dönüşümü yapılıyor...',
    paused: 'Duraklatıldı',
    done: 'İndirme tamamlandı!',
    ready: 'Hazır'
  };

  const STREAM_LABELS = ['Video indiriliyor...', 'Ses indiriliyor...'];

  const els = {
    body: document.body,
    url: document.getElementById('mediaUrl'),
    btnPaste: document.getElementById('btnPaste'),
    btnStart: document.getElementById('btnStart'),
    startSpinner: document.getElementById('startSpinner'),
    startLabel: document.getElementById('startLabel'),
    platformChip: document.getElementById('platformChip'),
    formatGrid: document.getElementById('formatGrid'),
    btnMp3: document.getElementById('btnMp3'),
    btnWav: document.getElementById('btnWav'),
    phase: document.getElementById('dl-phase'),
    percent: document.getElementById('dl-percent'),
    barFill: document.getElementById('barFill'),
    speed: document.getElementById('metSpeed'),
    size: document.getElementById('metSize'),
    eta: document.getElementById('metEta'),
    status: document.getElementById('dl-status'),
    controls: document.getElementById('dl-controls'),
    btnPause: document.getElementById('btnPause'),
    btnStop: document.getElementById('btnStop'),
    logBox: document.getElementById('log-box'),
    btnLogToggle: document.getElementById('btnLogToggle'),
    licenseBadge: document.getElementById('licenseBadge'),
    licenseBadgeText: document.getElementById('licenseBadgeText'),
    licenseOverlay: document.getElementById('licenseOverlay'),
    licenseKey: document.getElementById('license-key'),
    licenseMsg: document.getElementById('licenseMsg'),
    toast: document.getElementById('toast'),
    titlebar: document.getElementById('titlebar'),
    iconMaximize: document.getElementById('iconMaximize'),
    iconRestore: document.getElementById('iconRestore'),
    btnWinMax: document.getElementById('btnWinMax')
  };

  const state = {
    format: loadFormatState(),
    isPro: false,
    storeUrl: STORE_URL_FALLBACK,
    downloading: false,
    paused: false,
    lastPhase: 'ready',
    logVisible: localStorage.getItem(LOG_VISIBLE_KEY) !== '0',
    demoTimer: null,
    pendingProCard: null
  };

  function loadFormatState() {
    try {
      const raw = JSON.parse(localStorage.getItem(FORMAT_KEY) || '');
      if (!raw || typeof raw !== 'object') return F.createFormatState();
      const next = F.createFormatState(raw);
      const kinds = Object.values(F.KIND);
      const resolutions = Object.values(F.RESOLUTION);
      const audios = Object.values(F.AUDIO);
      if (!kinds.includes(next.kind) || !resolutions.includes(next.resolution) || !audios.includes(next.audio)) {
        return F.createFormatState();
      }
      return next;
    } catch {
      return F.createFormatState();
    }
  }

  function saveFormatState() {
    localStorage.setItem(FORMAT_KEY, JSON.stringify(state.format));
  }

  function assetUrl(rel) {
    return new URL(rel, window.location.href).href;
  }

  const sfxClick = new Audio(assetUrl('../../assets/Web Button Click.mp3'));
  const sfxSuccess = new Audio(assetUrl('../../assets/download succes.mp3'));
  sfxClick.preload = sfxSuccess.preload = 'auto';

  function playClick() {
    sfxClick.currentTime = 0;
    void sfxClick.play().catch(() => {});
  }

  function playSuccess() {
    sfxSuccess.currentTime = 0;
    void sfxSuccess.play().catch(() => {});
  }

  function logLine(text, type = 'info') {
    const span = document.createElement('span');
    span.className = `log-line ${type}`;
    span.textContent = `[${new Date().toLocaleTimeString('tr-TR')}] ${text}`;
    els.logBox.appendChild(span);
    els.logBox.scrollTop = els.logBox.scrollHeight;
  }

  function clearLog() {
    els.logBox.innerHTML = '';
  }

  function applyLogVisibility() {
    els.logBox.classList.toggle('is-collapsed', !state.logVisible);
    els.btnLogToggle.textContent = state.logVisible ? 'Gizle' : 'Göster';
  }

  function setStatus(msg, type = '') {
    els.status.textContent = msg || '';
    els.status.className = type === 'error' ? 'is-error' : type === 'success' ? 'is-ok' : '';
  }

  function showToast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('is-on');
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => els.toast.classList.remove('is-on'), 5200);
  }

  function setBar(percent, instant = false) {
    const value = Math.max(0, Math.min(100, percent));
    if (instant) {
      els.barFill.classList.add('no-transition');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        els.barFill.classList.remove('no-transition');
      }));
    }
    els.barFill.style.width = `${value}%`;
    els.percent.textContent = value < 100 ? `%${value.toFixed(1)}` : '%100';
  }

  function setPhase(phase) {
    if (phase !== 'paused') state.lastPhase = phase;
    els.phase.textContent = PHASE_LABELS[phase] || phase;
  }

  function setMetric(el, value) {
    el.textContent = value || '—';
  }

  function resetPanel() {
    setBar(0, true);
    state.lastPhase = 'analyzing';
    setPhase('analyzing');
    setMetric(els.speed, null);
    setMetric(els.size, null);
    setMetric(els.eta, null);
    setStatus('');
  }

  function renderFormatCards() {
    els.formatGrid.querySelectorAll('.format-card').forEach((card) => {
      const id = card.dataset.card;
      const active = F.isCardActive(state.format, id);
      const locked = F.isCardLocked(state.format, id, state.isPro);
      card.classList.toggle('is-active', active);
      card.classList.toggle('is-locked', locked);
      card.classList.toggle('is-dim', id === '4k' || id === '1080p' ? state.format.kind === F.KIND.AUDIO : false);
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    els.btnMp3.classList.toggle('is-on', state.format.audio === F.AUDIO.MP3);
    els.btnWav.classList.toggle('is-on', state.format.audio === F.AUDIO.WAV);
    const audioToggle = document.getElementById('audioToggle');
    if (audioToggle) audioToggle.hidden = state.format.kind !== F.KIND.AUDIO;
  }

  function applyLicenseUI(snapshot) {
    state.isPro = !!snapshot?.isPro;
    if (snapshot?.storeUrl) state.storeUrl = snapshot.storeUrl;
    els.body.classList.toggle('is-pro', state.isPro);
    els.licenseBadge.classList.toggle('is-pro', state.isPro);
    els.licenseBadgeText.textContent = state.isPro ? 'Aktif / Lisanslı' : 'Pasif / Ücretsiz';
    if (!state.isPro && F.resolveFormat(state.format).pro) {
      state.format = F.createFormatState();
      state.pendingProCard = null;
    } else if (state.isPro && state.pendingProCard) {
      state.format = F.selectCard(state.format, state.pendingProCard);
      state.pendingProCard = null;
    }
    saveFormatState();
    renderFormatCards();
  }

  function openLicenseModal(message = '', type = '') {
    els.licenseOverlay.hidden = false;
    els.licenseOverlay.classList.add('is-open');
    els.licenseMsg.textContent = message;
    els.licenseMsg.className = 'license-msg' + (type ? ` ${type}` : '');
    els.licenseKey?.focus();
  }

  function closeLicenseModal() {
    els.licenseOverlay.classList.remove('is-open');
    els.licenseOverlay.hidden = true;
  }

  function requirePro(reason) {
    if (state.isPro) return true;
    setStatus(reason, 'error');
    logLine(reason, 'warn');
    openLicenseModal(reason, 'err');
    return false;
  }

  function lockStart() {
    state.downloading = true;
    els.btnStart.disabled = true;
    els.startLabel.textContent = 'İndiriliyor...';
    els.startSpinner.classList.add('is-on');
    els.controls.classList.add('is-on');
    els.btnPause.disabled = false;
    els.btnStop.disabled = false;
    els.btnPause.textContent = 'Duraklat';
    state.paused = false;
    els.barFill.classList.remove('is-paused');
  }

  function unlockStart() {
    state.downloading = false;
    state.paused = false;
    els.btnStart.disabled = false;
    els.startLabel.textContent = START_LABEL;
    els.startSpinner.classList.remove('is-on');
    els.controls.classList.remove('is-on');
    els.barFill.classList.remove('is-paused');
    if (state.demoTimer) {
      window.clearInterval(state.demoTimer);
      state.demoTimer = null;
    }
  }

  function updatePlatformChip() {
    const platform = F.detectPlatform(els.url.value);
    if (!platform) {
      els.platformChip.classList.remove('is-on');
      els.platformChip.textContent = '';
      return;
    }
    els.platformChip.classList.add('is-on');
    els.platformChip.textContent = platform === 'x' ? 'X / TWITTER' : 'YOUTUBE';
  }

  async function pasteUrl() {
    playClick();
    try {
      let text = '';
      if (api?.readClipboard) {
        text = await api.readClipboard();
      } else if (navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }
      text = String(text || '').trim();
      const found = (text.match(/https?:\/\/[^\s<>"']+/gi) || []).find((u) => F.isSupportedUrl(u));
      const value = found || text;
      if (!value) {
        setStatus('Pano boş. Önce bir YouTube veya X bağlantısı kopyala.', 'error');
        return;
      }
      els.url.value = value;
      els.url.dispatchEvent(new Event('input'));
      updatePlatformChip();
      setStatus('');
      logLine('Pano içeriği yapıştırıldı.', 'dim');
    } catch (err) {
      setStatus('Pano okunamadı. Ctrl+V ile yapıştırmayı dene.', 'error');
      logLine(err?.message || 'Pano okunamadı.', 'err');
    }
  }

  function startDownload() {
    playClick();
    const url = els.url.value.trim();
    if (!url) {
      setStatus('Link yok.', 'error');
      logLine('URL girilmedi.', 'err');
      return;
    }
    if (!F.isSupportedUrl(url)) {
      setStatus('Geçerli bir YouTube veya X / Twitter bağlantısı gir.', 'error');
      logLine('Geçersiz bağlantı.', 'err');
      return;
    }

    const resolved = F.resolveFormat(state.format);
    if (resolved.pro && !requirePro('Bu format Pro plana özel. Lütfen Pro\'ya geç.')) {
      return;
    }

    clearLog();
    logLine('İndirme başlatılıyor...', 'info');
    logLine(`URL: ${url}`, 'dim');
    logLine(`Format: ${resolved.label}`, 'dim');
    lockStart();
    resetPanel();
    setStatus(`${resolved.label} indiriliyor.`);

    if (api?.startDownload) {
      api.startDownload(url, resolved.id);
      return;
    }

    simulateDownload(resolved.label);
  }

  function simulateDownload(label) {
    let pct = 0;
    logLine('Önizleme modu: motor bağlı değil, ilerleme simüle ediliyor.', 'warn');
    state.demoTimer = window.setInterval(() => {
      pct = Math.min(100, pct + 7 + Math.random() * 8);
      applyProgress({
        percent: pct,
        speed: '12.4 MB/s',
        size: '48.2 MiB',
        eta: pct >= 100 ? null : '00:08'
      });
      if (pct >= 100) {
        window.clearInterval(state.demoTimer);
        state.demoTimer = null;
        onComplete(`${label.replace(/\s+/g, '_')}.mp4`);
      }
    }, 280);
  }

  function applyProgress(raw) {
    const data = F.normalizeProgress(raw);
    setBar(data.percent);
    setMetric(els.speed, F.displaySpeed(data.speed));
    setMetric(els.size, data.size);
    setMetric(els.eta, F.displayEta(data.eta));
  }

  function onComplete(file) {
    setBar(100);
    setPhase('done');
    setMetric(els.speed, null);
    setMetric(els.eta, null);
    setStatus(`${file} indirildi.`, 'success');
    logLine(`Tamamlandı: ${file}`, 'ok');
    unlockStart();
    playSuccess();
    showToast(`İndirme tamamlandı · ${file}`);
    if (api?.notify) {
      api.notify({ title: 'MediaPull', body: `${file} indirildi.` });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('MediaPull', { body: `${file} indirildi.` });
    }
  }

  function bindFormatCards() {
    els.formatGrid.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('[data-audio]')) return;
      const card = event.target.closest('.format-card');
      if (!card) return;
      event.preventDefault();
      card.click();
    });
    els.formatGrid.addEventListener('click', (event) => {
      const audioBtn = event.target.closest('[data-audio]');
      if (audioBtn) {
        event.stopPropagation();
        playClick();
        const next = F.selectCard(state.format, audioBtn.dataset.audio);
        if (F.resolveFormat(next).pro && !requirePro('WAV çıktısı Pro plana özel.')) {
          state.pendingProCard = audioBtn.dataset.audio;
          return;
        }
        state.format = next;
        state.pendingProCard = null;
        saveFormatState();
        renderFormatCards();
        return;
      }

      const card = event.target.closest('.format-card');
      if (!card) return;
      playClick();
      const next = F.selectCard(state.format, card.dataset.card);
      if (F.resolveFormat(next).pro && !requirePro('Bu format Pro plana özel. Lütfen Pro\'ya geç.')) {
        state.pendingProCard = card.dataset.card;
        return;
      }
      state.format = next;
      state.pendingProCard = null;
      saveFormatState();
      renderFormatCards();
    });
  }

  function bindWindowControls() {
    document.getElementById('btnWinMin').addEventListener('click', () => api?.windowMinimize?.());
    els.btnWinMax.addEventListener('click', () => api?.windowMaximize?.());
    document.getElementById('btnWinClose').addEventListener('click', () => api?.windowClose?.());
    els.titlebar.addEventListener('dblclick', (event) => {
      if (event.target.closest('.titlebar-controls')) return;
      api?.windowMaximize?.();
    });
    api?.onWindowMaximized?.((maximized) => {
      els.iconMaximize.style.display = maximized ? 'none' : 'block';
      els.iconRestore.style.display = maximized ? 'block' : 'none';
      els.btnWinMax.title = maximized ? 'Geri al' : 'Büyüt';
      els.btnWinMax.setAttribute('aria-label', maximized ? 'Geri al' : 'Büyüt');
    });
  }

  function bindLicense() {
    els.licenseBadge.addEventListener('click', () => {
      playClick();
      openLicenseModal(
        state.isPro ? 'Pro lisansın aktif.' : 'Pro özellikler için lisansını etkinleştir.',
        state.isPro ? 'ok' : ''
      );
    });
    document.getElementById('btnLicenseClose').addEventListener('click', closeLicenseModal);
    els.licenseOverlay.addEventListener('click', (event) => {
      if (event.target.id === 'licenseOverlay') closeLicenseModal();
    });
    document.getElementById('btnLicenseBuy').addEventListener('click', () => {
      playClick();
      if (api?.openExternal) api.openExternal(state.storeUrl);
    });
    document.getElementById('btnLicenseLogout').addEventListener('click', async () => {
      playClick();
      const result = await api?.licenseLogout?.();
      applyLicenseUI(result);
      if (result?.ok) {
        els.licenseMsg.textContent = result.warning || 'Pro hesaptan çıkış yapıldı.';
        els.licenseMsg.className = 'license-msg' + (result.warning ? ' err' : ' ok');
        logLine('Pro hesaptan çıkış yapıldı.', 'warn');
        els.licenseKey.value = '';
      } else {
        els.licenseMsg.textContent = result?.error || 'Çıkış başarısız.';
        els.licenseMsg.className = 'license-msg err';
      }
    });
    document.getElementById('btnLicenseActivate').addEventListener('click', async () => {
      playClick();
      const key = els.licenseKey.value.trim();
      if (!key) {
        els.licenseMsg.textContent = 'Lisans anahtarı gir.';
        els.licenseMsg.className = 'license-msg err';
        return;
      }
      const result = await api?.licenseActivate?.(key);
      if (result?.ok) {
        applyLicenseUI(result);
        els.licenseMsg.textContent = 'Pro plan etkinleştirildi.';
        els.licenseMsg.className = 'license-msg ok';
        logLine('Pro lisans etkinleştirildi.', 'ok');
      } else {
        els.licenseMsg.textContent = result?.error || 'Doğrulama başarısız.';
        els.licenseMsg.className = 'license-msg err';
      }
    });
  }

  function bindIpc() {
    api?.onDownloadProgress?.(applyProgress);
    api?.onDownloadLog?.((line) => {
      const text = String(line || '').replace(/\[info\]\s*/gi, '').trim();
      if (!text || /^\[(debug|youtube|twitter|x|generic)\]/i.test(text)) return;
      logLine(text, 'dim');
    });
    api?.onDownloadPhase?.((phase) => {
      setPhase(phase);
      logLine(PHASE_LABELS[phase] || phase, 'info');
      if (phase === 'converting') {
        setStatus('Adobe uyumlu H.264 kodlanıyor. GPU varsa bu adım çok daha kısa sürer.');
        setMetric(els.speed, null);
        setMetric(els.eta, null);
      }
    });
    api?.onDownloadStream?.((idx) => {
      setBar(0, true);
      const label = STREAM_LABELS[idx] || 'İndiriliyor...';
      setPhase(label);
      logLine(label, 'info');
    });
    api?.onDownloadPaused?.(() => {
      state.paused = true;
      els.btnPause.disabled = false;
      els.btnPause.textContent = 'Devam Et';
      els.barFill.classList.add('is-paused');
      setPhase('paused');
      setMetric(els.speed, null);
      setMetric(els.eta, null);
      logLine('İndirme duraklatıldı. Devam Et ile kaldığı yerden sürdürülür.', 'warn');
    });
    api?.onDownloadResumed?.(() => {
      state.paused = false;
      els.btnPause.textContent = 'Duraklat';
      els.barFill.classList.remove('is-paused');
      setPhase(state.lastPhase);
      logLine('İndirme devam ediyor.', 'info');
    });
    api?.onDownloadCancelled?.(() => {
      setStatus('İndirme iptal edildi.', 'error');
      logLine('İndirme kullanıcı tarafından durduruldu.', 'warn');
      unlockStart();
    });
    api?.onDownloadComplete?.(onComplete);
    api?.onDownloadError?.((message) => {
      const text = String(message || '').replace(/\[info\]\s*/gi, '').trim();
      setStatus(`Hata: ${text}`, 'error');
      logLine(`Hata: ${text}`, 'err');
      unlockStart();
    });
    api?.onLicenseUpdated?.(applyLicenseUI);
    api?.onLicenseRequired?.(() => {
      openLicenseModal('Bu format Pro plana özel. Lütfen lisansını etkinleştir.', 'err');
    });
  }

  function bindUi() {
    els.btnPaste.addEventListener('click', pasteUrl);
    els.btnStart.addEventListener('click', startDownload);
    els.url.addEventListener('input', updatePlatformChip);
    els.url.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') startDownload();
    });
    els.btnLogToggle.addEventListener('click', () => {
      state.logVisible = !state.logVisible;
      localStorage.setItem(LOG_VISIBLE_KEY, state.logVisible ? '1' : '0');
      applyLogVisibility();
    });
    els.btnPause.addEventListener('click', () => {
      playClick();
      if (state.paused) api?.resumeDownload?.();
      else {
        els.btnPause.disabled = true;
        api?.pauseDownload?.();
      }
    });
    els.btnStop.addEventListener('click', () => {
      playClick();
      els.btnPause.disabled = true;
      els.btnStop.disabled = true;
      if (api?.stopDownload) api.stopDownload();
      else unlockStart();
    });
    document.getElementById('btnSite').addEventListener('click', () => {
      if (api?.openExternal) api.openExternal(SITE_URL);
    });
  }

  applyLogVisibility();
  renderFormatCards();
  bindFormatCards();
  bindWindowControls();
  bindLicense();
  bindIpc();
  bindUi();

  if (api?.licenseCheck) {
    api.licenseCheck().then(applyLicenseUI).catch(() => {});
  } else {
    applyLicenseUI({ isPro: false });
    logLine('Renderer hazır. IPC köprüsü yoksa önizleme modu kullanılır.', 'dim');
  }
})();
