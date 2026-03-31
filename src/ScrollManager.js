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
    // Wait until metadata is loaded
    await this.canvasPlayer.loadMetadata();
    
    // We create a ScrollTrigger for each scene
    this.sections.forEach((section, index) => {
      const sceneNum = parseInt(section.dataset.scene);
      const frameCount = this.canvasPlayer.getFrameCount(sceneNum);
      
      const glassCard = section.querySelector('.glass-card');
      
      if (frameCount === 0) {
        console.warn(`No frames found for scene ${sceneNum}`);
        return;
      }

      // Proxy object used by GSAP to tween values easily
      const proxy = { frame: 0 };
      
      // Image sequence scroll trigger track
      gsap.to(proxy, {
        frame: frameCount - 1,
        snap: "frame", // Optional: snap to nearest integer for sharper playback
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top", // When section top touches viewport top
          end: "bottom top", // Plays across the section's height (150vh)
          scrub: 1.0, // Buttery smooth interpolation mapping scroll to frame
          onUpdate: (self) => {
            if (self.isActive) {
               // Render only when actively scrolling inside this trigger
               this.canvasPlayer.setFrame(sceneNum, Math.round(proxy.frame));
            }
          },
          onEnter: () => {
             this.audioManager.playSceneAudio(sceneNum);
          },
          onEnterBack: () => {
             this.audioManager.playSceneAudio(sceneNum);
          }
        }
      });
      
      // Glass card text fading animation
      // Appears cleanly entering viewport, disappears cleanly exiting
      gsap.fromTo(glassCard, 
        { opacity: 0, y: 30 },
        {
          opacity: 1, 
          y: 0,
          scrollTrigger: {
            trigger: section,
            start: "top 60%", // Start fading in when section reaches 60% viewport
            end: "bottom 60%", // Finish full fade out loop when leaving
            toggleActions: "play reverse play reverse", // State changes
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
        this.resumeAutoScroll();
      }, 2000); // Resume 2 seconds after scroll stops
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
