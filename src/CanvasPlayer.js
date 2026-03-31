export class CanvasPlayer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false }); 
    this.videos = {}; 
    this.scenesMeta = null;

    this.currentScene = 1;
    this.isLooping = false;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  async loadMetadata() {
    try {
      const res = await fetch('/scenes_meta.json');
      this.scenesMeta = await res.json();
      
      for (let i = 1; i <= 12; i++) {
        const video = document.createElement('video');
        video.src = `/video/${i}-scene.mp4`;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto'; 
        video.style.display = 'none';
        
        // Critical iOS hack
        video.load(); 

        this.videos[i] = video;
      }
      
      // Kick off constant tick
      this.startRenderLoop();
    } catch (err) {
      console.error('Error loading scenes metadata:', err);
    }
  }

  async preloadCriticalFrames(onProgress) {
    const mainVideo = this.videos[1];
    if (!mainVideo) return;

    return new Promise((resolve) => {
      let pct = 0;
      const fakeProgress = setInterval(() => {
         pct += 5;
         if (pct <= 95) onProgress(pct);
      }, 50);

      const finish = () => {
         clearInterval(fakeProgress);
         onProgress(100);
         resolve();
      };

      if (mainVideo.readyState >= 3) {
         finish();
      } else {
         mainVideo.addEventListener('canplaythrough', finish, { once: true });
         setTimeout(finish, 4000);
      }
    });
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  getFrameCount(sceneNum) {
    const key = `${sceneNum}-scene`;
    if (!this.scenesMeta || !this.scenesMeta[key]) return 0;
    return this.scenesMeta[key].length;
  }

  setFrame(sceneNum, frameIndex) {
    this.currentScene = sceneNum;
    const video = this.videos[sceneNum];
    
    if (video) {
        const timeInSeconds = frameIndex / 30;
        // Prevent micro-stutters by rejecting minuscule delta floats
        if (Math.abs(video.currentTime - timeInSeconds) > 0.01) {
            video.currentTime = timeInSeconds;
        }
    }
  }

  startRenderLoop() {
    if (this.isLooping) return;
    this.isLooping = true;
    
    const tick = () => {
       const video = this.videos[this.currentScene];
       // readyState 2+ guarantees there is data for the current frame to draw
       if (video && video.readyState >= 2) {
           this.drawCover(video);
       }
       requestAnimationFrame(tick);
    };
    tick();
  }

  drawCover(video) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    const vw = video.videoWidth || 1920; 
    const vh = video.videoHeight || 1080;
    
    if (vw === 0) return; 

    // Calculate aspect ratio covering
    const scale = Math.max(w / vw, h / vh);
    
    const dx = (w - (vw * scale)) / 2;
    const dy = (h - (vh * scale)) / 2;
    
    this.ctx.fillRect(0, 0, w, h); 
    this.ctx.drawImage(video, dx, dy, vw * scale, vh * scale);
  }
}
