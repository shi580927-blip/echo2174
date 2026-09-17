(() => {
  const STAGE_W = 1920;
  const STAGE_H = 1080;
  const stage = document.getElementById('stage');
  const sceneImage = document.getElementById('sceneImage');
  const sceneFallback = document.getElementById('sceneFallback');
  const fullscreenButton = document.getElementById('fullscreenButton');
  const fullscreenLabel = fullscreenButton?.querySelector('.fullscreen-label');

  function viewportSize() {
    const vv = window.visualViewport;
    return {
      width: Math.max(1, vv ? vv.width : window.innerWidth),
      height: Math.max(1, vv ? vv.height : window.innerHeight)
    };
  }

  function fitMobileStage() {
    if (!stage) return;
    const { width, height } = viewportSize();
    const scale = Math.min(width / STAGE_W, height / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function showFallback(show) {
    if (!sceneFallback) return;
    sceneFallback.classList.toggle('is-visible', !!show);
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function setFullscreenButtonState() {
    if (!fullscreenButton) return;
    const active = !!fullscreenElement();
    fullscreenButton.classList.toggle('is-active', active);
    fullscreenButton.setAttribute('aria-label', active ? 'Выйти из полноэкранного режима' : 'На весь экран');
    if (fullscreenLabel) fullscreenLabel.textContent = active ? 'Выйти из полного' : 'На весь экран';
    setTimeout(fitMobileStage, 80);
    setTimeout(fitMobileStage, 300);
  }

  async function enterFullscreen() {
    const target = document.documentElement;
    const request = target.requestFullscreen || target.webkitRequestFullscreen;
    if (!request) {
      fullscreenButton?.classList.add('is-unsupported');
      return;
    }

    try {
      if (target.requestFullscreen) {
        try {
          await target.requestFullscreen({ navigationUI: 'hide' });
        } catch {
          await target.requestFullscreen();
        }
      } else {
        target.webkitRequestFullscreen();
      }

      if (screen.orientation?.lock && window.matchMedia('(orientation: landscape)').matches) {
        try { await screen.orientation.lock('landscape'); } catch { /* optional */ }
      }
    } catch (error) {
      console.warn('Fullscreen request failed:', error);
    }
  }

  async function exitFullscreen() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (error) {
      console.warn('Fullscreen exit failed:', error);
    }
  }

  async function toggleFullscreen() {
    if (fullscreenElement()) await exitFullscreen();
    else await enterFullscreen();
    setTimeout(setFullscreenButtonState, 50);
  }

  if (sceneImage) {
    sceneImage.addEventListener('load', () => showFallback(false));
    sceneImage.addEventListener('error', () => showFallback(true));
    if (sceneImage.complete) showFallback(!sceneImage.naturalWidth);
  }

  if (fullscreenButton) {
    const supported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
    if (!supported) fullscreenButton.classList.add('is-unsupported');
    fullscreenButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggleFullscreen();
    });
  }

  document.addEventListener('fullscreenchange', setFullscreenButtonState);
  document.addEventListener('webkitfullscreenchange', setFullscreenButtonState);

  window.addEventListener('resize', fitMobileStage, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(fitMobileStage, 150), { passive: true });
  window.addEventListener('pageshow', () => setTimeout(fitMobileStage, 0), { passive: true });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', fitMobileStage, { passive: true });
    visualViewport.addEventListener('scroll', fitMobileStage, { passive: true });
  }

  fitMobileStage();
  setFullscreenButtonState();
})();
