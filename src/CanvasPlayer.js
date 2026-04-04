export class CanvasPlayer {
  constructor(canvasElement, metaUrl = '/scenes_meta.json', scenesBaseDir = '/scenes/') {
    this.canvas = canvasElement;
    this.metaUrl = metaUrl;
    this.scenesBaseDir = scenesBaseDir;
    
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.scenesMeta = null;
    
    // Sliding Window Memory Strategy (Current-1, Current, Current+1)
    this.activeSceneCache = new Map();

    this.currentScene = 1;
    this.currentFrame = 0;
    
    this.targetScene = 1;
    this.targetFrame = 0;
    
    this.isRendering = false;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  async loadMetadata() {
    try {
      const res = await fetch(this.metaUrl);
      this.scenesMeta = await res.json();
    } catch (err) {
      console.error('Error loading scenes metadata:', err);
    }
  }

  async preloadSceneToCache(sceneNum) {
      if (!this.scenesMeta || sceneNum < 1 || sceneNum > Object.keys(this.scenesMeta).length) return;
      const sceneKey = `${sceneNum}-scene`;
      if (!this.scenesMeta[sceneKey]) return;
      
      if (this.activeSceneCache.has(sceneNum)) return; // Already cached
      
      const sceneMap = new Map();
      this.activeSceneCache.set(sceneNum, sceneMap);
      
      const count = this.scenesMeta[sceneKey].length;
      let loaded = 0;
      
      return new Promise((resolve) => {
          for (let i = 0; i < count; i++) {
              let url = `${this.scenesBaseDir}${sceneKey}/${this.scenesMeta[sceneKey][i]}`;
              // Force paths matching Vite roots perfectly
              if (!url.startsWith('/')) url = '/' + url;
              
              const img = new Image();
              
              const checkDone = () => {
                  loaded++;
                  if (loaded >= count) resolve();
              };
              img.onload = checkDone;
              img.onerror = checkDone;
              
              // Non-blocking background DOM allocation
              img.src = url;
              sceneMap.set(i, img);
          }
      });
  }

  // Preloader hook for start 
  async preloadCriticalFrames(onProgress) {
      if (!this.scenesMeta) return Promise.resolve();
      return new Promise((resolve) => {
          this.preloadSceneToCache(1).then(() => {
              onProgress(100);
              resolve();
          });
          
          let pct = 0;
          const fakeP = setInterval(() => {
              pct += 5;
              if (pct <= 95) onProgress(pct);
              else clearInterval(fakeP);
          }, 50);
          
          // Aggressively preempt scene 2 seamlessly in the background!
          this.preloadSceneToCache(2);
      });
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    
    if (!this.isRendering && this.scenesMeta) this.renderCurrentFrame();
  }

  getFrameCount(sceneNum) {
    const key = `${sceneNum}-scene`;
    if (!this.scenesMeta || !this.scenesMeta[key]) return 0;
    return this.scenesMeta[key].length;
  }

  // Flushes out distant scenes mathematically preventing RAM OOM blackscreen crash
  bufferWindow(activeSceneNum) {
      // We only statically hold exactly 3 scenes mathematically (Previous, Current, Next)
      const needed = [activeSceneNum - 1, activeSceneNum, activeSceneNum + 1];
      
      for (const [sNum, map] of this.activeSceneCache.entries()) {
          if (!needed.includes(sNum)) {
              // Flush safely from memory!
              map.clear();
              this.activeSceneCache.delete(sNum);
          }
      }
      
      // Dynamically initiate pre-fetching of upcoming horizons flawlessly seamlessly.
      const totalScenes = Object.keys(this.scenesMeta).length;
      needed.forEach(n => {
          if (n >= 1 && n <= totalScenes) {
             this.preloadSceneToCache(n); // Executes immediately without `await` block!
          }
      });
  }

  setFrame(sceneNum, frameIndex) {
    this.targetScene = sceneNum;
    this.targetFrame = Math.floor(frameIndex);
    
    // Ensure sliding memory window bounds are strictly evaluated per GSAP tick
    this.bufferWindow(this.targetScene);
    
    if (!this.isRendering) {
      this.isRendering = true;
      requestAnimationFrame(() => this.renderLoop());
    }
  }

  renderLoop() {
    this.currentScene = this.targetScene;
    this.currentFrame = this.targetFrame;
    
    this.renderCurrentFrame();
    
    this.isRendering = false;
  }

  renderCurrentFrame() {
    const sceneMap = this.activeSceneCache.get(this.currentScene);
    if (!sceneMap) return;
    
    const img = sceneMap.get(this.currentFrame);
    if (!img || !img.complete || img.naturalWidth === 0) return; 
    
    this.drawCover(img);
  }

  drawCover(img) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    
    const scale = Math.max(w / iw, h / ih);
    
    const dx = (w - (iw * scale)) / 2;
    const dy = (h - (ih * scale)) / 2;
    
    this.ctx.fillRect(0, 0, w, h); 
    this.ctx.drawImage(img, dx, dy, iw * scale, ih * scale);
  }
}
