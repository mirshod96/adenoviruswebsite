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

  async forceSceneLoad(sceneNum) {
    // Only intercept if the scene isn't already the dominant loaded chunk
    if (this.canvasPlayer.currentPreloadedScene === sceneNum) return;
    
    // HARD LOCK user intent
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Halt any active auto-scroll
    if (this.autoScrollTween) {
        this.autoScrollTween.kill();
        this.autoScrollTween = null;
    }
    
    const loader = document.getElementById('scene-transition-loader');
    const fill = document.getElementById('scene-transition-fill');
    const pctTxt = document.getElementById('scene-transition-pct');
    
    if (loader) {
        loader.style.visibility = 'visible';
        loader.style.opacity = '1';
        loader.style.pointerEvents = 'all';
    }
    
    // CPU/Network wipe boundary crossing point
    await this.canvasPlayer.preloadEntireScene(sceneNum, (pct) => {
         if(fill) fill.style.width = `${pct}%`;
         if(pctTxt) pctTxt.textContent = `${pct}%`;
    });
    
    if (loader) {
        loader.style.opacity = '0';
        loader.style.pointerEvents = 'none';
        setTimeout(() => {
            loader.style.visibility = 'hidden';
        }, 500); // Wait for transition CSS to finish
    }
    
    // UNLOCK user scroll
    document.body.style.overflow = prevOverflow;
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
             // CRITICAL: Block rendering GSAP ticks for scenes that are functionally wiped!
             // This prevents "flicker" while the glass loader covers the transition.
             if (self.isActive && this.canvasPlayer.currentPreloadedScene === sceneNum) {
                this.canvasPlayer.setFrame(sceneNum, Math.round(proxy.frame));
             }
          },
          onEnter: () => {
             this.forceSceneLoad(sceneNum);
             this.audioManager.playSceneAudio(sceneNum);
          },
          onEnterBack: () => {
             this.forceSceneLoad(sceneNum);
             this.audioManager.playSceneAudio(sceneNum);
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
    const onUserInteraction = () => {
      if (this.autoScrollTween) {
        this.autoScrollTween.kill();
        this.autoScrollTween = null;
      }
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Prevent auto-scroll if loading screen is active covering viewport
        const loader = document.getElementById('scene-transition-loader');
        if (loader && loader.style.opacity === '1') return;
        
        this.resumeAutoScroll();
      }, 2000); 
    };

    window.addEventListener("wheel", onUserInteraction, { passive: true });
    window.addEventListener("touchmove", onUserInteraction, { passive: true });
    window.addEventListener("mousedown", onUserInteraction, { passive: true });
    window.addEventListener("keydown", (e) => {
        if (['ArrowDown', 'ArrowUp', 'Space', 'PageDown', 'PageUp'].includes(e.code)) {
            onUserInteraction();
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
