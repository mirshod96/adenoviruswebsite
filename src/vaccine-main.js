import './style.css';
import { CanvasPlayer } from './CanvasPlayer';
import { AudioManager } from './AudioManager';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// On page refresh, force starting from the very top (Scene 1)
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
  const canvasElement = document.getElementById('hero-canvas');
  
  // Use generic parameters specifically targeting the new generated index
  const audioManager = new AudioManager();
  const canvasPlayer = new CanvasPlayer(canvasElement, '/vaccine_meta.json', '/vaccine_box_scenes/');
  
  const startOverlay = document.getElementById('start-overlay');
  const btnStart = document.getElementById('btn-start');
  const loaderProgress = document.getElementById('loader-progress');
  const audioToggle = document.getElementById('audio-toggle');

  let autoScrollTween = null;

  btnStart.addEventListener('click', async () => {
    if (audioManager.isMuted) {
      await audioManager.toggleAudio();
    }
    startOverlay.style.opacity = '0';
    startOverlay.style.visibility = 'hidden';
    startAutoScroll();
  });
  
  audioToggle.addEventListener('click', async () => {
      await audioManager.toggleAudio();
      audioToggle.innerHTML = audioManager.isMuted ? '<span class="icon">🔇</span>' : '<span class="icon">🔊</span>';
  });

  const sections = document.querySelectorAll('.stage-section');

  async function initScrollTracks() {
      await canvasPlayer.loadMetadata();
      
      sections.forEach((section) => {
        const sceneNum = parseInt(section.dataset.scene);
        const frameCount = canvasPlayer.getFrameCount(sceneNum);
        if (frameCount === 0) return;
  
        const proxy = { frame: 0 };
        
        gsap.to(proxy, {
          frame: frameCount - 1,
          snap: "frame", 
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top", 
            end: "bottom top", 
            scrub: 1.0, 
            onUpdate: (self) => {
               if (self.isActive) {
                  const currentFrame = Math.round(proxy.frame);
                  canvasPlayer.setFrame(sceneNum, currentFrame);
                  audioManager.syncAudioToFrame(sceneNum, currentFrame, frameCount, self.getVelocity());
               }
            }
          }
        });
      });

      // Special Logic for Stage 2 Card mapping to 50% scroll
      const vaccineCard = document.querySelector('.vaccine-card');
      if (vaccineCard) {
          gsap.fromTo(vaccineCard, 
              { opacity: 0, x: 100, y: isMobile() ? 100 : '-50%' },
              {
                  opacity: 1, 
                  x: 0,
                  y: isMobile() ? 0 : '-50%',
                  ease: "power2.out",
                  scrollTrigger: {
                      trigger: "#stage-2",
                      start: "50% 60%", // Triggers when stage 2 is at 50%
                      end: "100% 60%",
                      scrub: 1.0, // Parallax binding
                  }
              }
          );
      }
  }

  function isMobile() {
      return window.innerWidth <= 768;
  }

  function startAutoScroll() {
    resumeAutoScroll();
    let scrollTimeout;
    const onUserInteraction = (e) => {
      if (e && e.target && e.target.closest('#audio-toggle')) return;
      if (autoScrollTween) {
        autoScrollTween.kill();
        autoScrollTween = null;
      }
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        resumeAutoScroll();
      }, 2000); 
    };

    window.addEventListener("wheel", onUserInteraction, { passive: true });
    window.addEventListener("touchmove", onUserInteraction, { passive: true });
    window.addEventListener("mousedown", onUserInteraction, { passive: true });
    window.addEventListener("keydown", (e) => {
        if (['ArrowDown', 'ArrowUp', 'Space', 'PageDown', 'PageUp'].includes(e.code)) {
            onUserInteraction(e);
        }
    }, { passive: true });
  }

  function resumeAutoScroll() {
    if (autoScrollTween) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const currentScroll = window.scrollY;
    const remainingDistance = maxScroll - currentScroll;
    if (remainingDistance <= 10) return;

    const totalDuration = 100; 
    const remainingDuration = (remainingDistance / maxScroll) * totalDuration;

    const scrollProxy = { y: currentScroll };
    autoScrollTween = gsap.to(scrollProxy, {
      y: maxScroll,
      duration: remainingDuration,
      ease: "none",
      onUpdate: () => {
        if (autoScrollTween) {
          window.scrollTo(0, scrollProxy.y);
        }
      }
    });
  }
  
  initScrollTracks().then(async () => {
      await canvasPlayer.preloadCriticalFrames((percent) => {
          loaderProgress.textContent = `Yuklanmoqda: ${percent}%`;
      });
      loaderProgress.style.display = 'none';
      btnStart.style.display = 'inline-block';
      document.querySelector('a.btn-primary').style.display = 'inline-block';
  });
  
  document.body.style.opacity = '1';
});
