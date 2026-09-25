(() => {
  const video = document.getElementById('warehouseIntroVideo');
  if (!video) return;

  let progress = 0;

  function seekToProgress() {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const time = Math.min(video.duration - .05, Math.max(0, progress * video.duration));
    if (Math.abs(video.currentTime - time) > .04) video.currentTime = time;
  }

  video.addEventListener('loadedmetadata', seekToProgress);
  video.addEventListener('loadeddata', () => video.classList.add('is-ready'));
  video.addEventListener('error', () => video.classList.remove('is-ready'));
  if (video.readyState >= 2) video.classList.add('is-ready');

  window.addEventListener('warehouse-tour-open', () => {
    video.pause();
    progress = 0;
    seekToProgress();
  });
  window.addEventListener('warehouse-tour-progress', event => {
    progress = event.detail.progress;
    seekToProgress();
  });
  window.addEventListener('warehouse-tour-close', () => {
    video.pause();
  });
  if (!document.getElementById('warehouseIntro').hidden) seekToProgress();
})();
