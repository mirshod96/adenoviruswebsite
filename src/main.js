import './style.css';
import { CanvasPlayer } from './CanvasPlayer';
import { AudioManager } from './AudioManager';
import { ScrollManager } from './ScrollManager';

// On page refresh, force starting from the very top (Scene 1)
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
  // Initialization of subsystems
  const canvasElement = document.getElementById('hero-canvas');
  
  const audioManager = new AudioManager();
  const canvasPlayer = new CanvasPlayer(canvasElement);
  
  // Attach components inside the scroll manager to build triggers
  const scrollManager = new ScrollManager(canvasPlayer, audioManager);
  
  // Start overlay logic
  const startOverlay = document.getElementById('start-overlay');
  const btnStart = document.getElementById('btn-start');
  const loaderProgress = document.getElementById('loader-progress');
  const audioToggle = document.getElementById('audio-toggle');

  btnStart.addEventListener('click', async () => {
    if (audioManager.isMuted) {
      await audioManager.toggleMute();
    }
    startOverlay.style.opacity = '0';
    startOverlay.style.visibility = 'hidden';
    scrollManager.startAutoScroll();
  });
  
  audioToggle.addEventListener('click', async () => {
      await audioManager.toggleMute();
      audioToggle.innerHTML = audioManager.isMuted ? '<span class="icon">🔇</span>' : '<span class="icon">🔊</span>';
  });
  
  // Await the internal metadata manifest then trigger heavy preload
  scrollManager.initScrollTracks().then(async () => {
      await canvasPlayer.preloadCriticalFrames((percent) => {
          loaderProgress.textContent = `Yuklanmoqda: ${percent}%`;
      });
      // Sequence safely in browser memory, release the UI block
      loaderProgress.style.display = 'none';
      btnStart.style.display = 'inline-block';
  });
  
  // Extra layer for initial setup visibility
  document.body.style.opacity = '1';
});
