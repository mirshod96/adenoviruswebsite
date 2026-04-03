import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export class ScrollManager {
  constructor(canvasPlayer, audioManager) {
    this.canvasPlayer = canvasPlayer;
    this.audioManager = audioManager;
    this.sections = document.querySelectorAll('.stage-section');
    
    this.initScrollTracks();
  }

  async initScrollTracks() {
    await this.canvasPlayer.loadMetadata();
    
    this.sections.forEach((section, index) => {
      const sceneNum = parseInt(section.dataset.scene);
      const frameCount = this.canvasPlayer.getFrameCount(sceneNum);
      
      const glassCard = section.querySelector('.glass-card');
      
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
                this.canvasPlayer.setFrame(sceneNum, currentFrame);
                
                // Blast live precision vectors into the Data manipulation sound engine
                this.audioManager.syncAudioToFrame(sceneNum, currentFrame, frameCount, self.getVelocity());
             }
          }
        }
      });
      
      gsap.fromTo(glassCard, 
        { opacity: 0, y: 30 },
        {
          opacity: 1, 
          y: 0,
          scrollTrigger: {
            trigger: section,
            start: "top 60%", 
            end: "bottom 60%", 
            toggleActions: "play reverse play reverse", 
          }
        }
      );
    });
  }

  startAutoScroll() {
    this.resumeAutoScroll();

    let scrollTimeout;
    const onUserInteraction = (e) => {
      // Prevent audio toggle block from killing animations
      if (e && e.target && e.target.closest('#audio-toggle')) return;
      
      if (this.autoScrollTween) {
        this.autoScrollTween.kill();
        this.autoScrollTween = null;
      }
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.resumeAutoScroll();
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

  resumeAutoScroll() {
    if (this.autoScrollTween) return;

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const currentScroll = window.scrollY;
    const remainingDistance = maxScroll - currentScroll;
    
    if (remainingDistance <= 10) return;

    const totalDuration = 120; // 2 minutes auto-play
    const remainingDuration = (remainingDistance / maxScroll) * totalDuration;

    const scrollProxy = { y: currentScroll };
    
    this.autoScrollTween = gsap.to(scrollProxy, {
      y: maxScroll,
      duration: remainingDuration,
      ease: "none",
      onUpdate: () => {
        if (this.autoScrollTween) {
          window.scrollTo(0, scrollProxy.y);
        }
      }
    });
  }
}
