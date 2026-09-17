(() => {
  const STAGE_W = 1920;
  const STAGE_H = 1080;
  const stage = document.getElementById('stage');
  const sceneImage = document.getElementById('sceneImage');
  const sceneFallback = document.getElementById('sceneFallback');

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

  if (sceneImage) {
    sceneImage.addEventListener('load', () => showFallback(false));
    sceneImage.addEventListener('error', () => showFallback(true));
    if (sceneImage.complete) showFallback(!sceneImage.naturalWidth);
  }

  window.addEventListener('resize', fitMobileStage, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(fitMobileStage, 150), { passive: true });
  window.addEventListener('pageshow', () => setTimeout(fitMobileStage, 0), { passive: true });
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', fitMobileStage, { passive: true });
    visualViewport.addEventListener('scroll', fitMobileStage, { passive: true });
  }

  fitMobileStage();
})();