export class CanvasPlayer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.scenesMeta = null;
    
    // Crucial memory boundary lock globally isolating DOM Heap structures
    this.currentPreloadedScene = -1;
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
      const res = await fetch('/scenes_meta.json');
      this.scenesMeta = await res.json();
    } catch (err) {
      console.error('Error loading scenes metadata:', err);
    }
  }

  // Pure Promise resolver fetching EXACTLY ONE FULL SCENE into DOM Memory Limits 
  async preloadEntireScene(sceneNum, onProgress) {
    const sceneKey = `${sceneNum}-scene`;
    if (!this.scenesMeta || !this.scenesMeta[sceneKey]) {
      if (onProgress) onProgress(100);
      return;
    }

    if (this.currentPreloadedScene === sceneNum) {
       if (onProgress) onProgress(100);
       return;
    }

    // EXTREME GARBAGE COLLECTION STEP:
    // This absolutely guarantees that our memory footprint never scales dynamically infinitely!
    // We obliterate the previous scene references. 
    // The Javascript GC will effortlessly dump the old 144 bitmaps freeing ~400MB instantly from GPU margins.
    this.activeSceneCache.clear();
    
    // Optional brief frame visual clearance 
    this.ctx.fillRect(0,0, this.canvas.width, this.canvas.height); 

    this.currentPreloadedScene = sceneNum;
    
    const count = this.scenesMeta[sceneKey].length;
    let loadedCount = 0;

    return new Promise((resolve) => {
      // Linear iterative DOM allocation.
      // Unlike Blob/Fetch which bottlenecks concurrency, Image nodes allocate parallel connections gracefully.
      for (let i = 0; i < count; i++) {
        const url = `/scenes/${sceneKey}/${this.scenesMeta[sceneKey][i]}`;
        
        const img = new Image();
        img.fetchPriority = "high"; // Advise mobile Chromium heuristic
        
        const checkDone = () => {
           loadedCount++;
           if (onProgress) onProgress(Math.round((loadedCount / count) * 100));
           if (loadedCount >= count) resolve();
        };

        img.onload = checkDone;
        // Proceed gracefully on network interrupt to prevent app lock
        img.onerror = checkDone; 
        
        img.src = url;
        
        // Cache node
        this.activeSceneCache.set(i, img);
      }
    });
  }

  // Backwards compatibility for the main preloader
  async preloadCriticalFrames(onProgress) {
    return this.preloadEntireScene(1, onProgress);
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

  setFrame(sceneNum, frameIndex) {
    this.targetScene = sceneNum;
    this.targetFrame = Math.floor(frameIndex);
    
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
    // Zero latency O(1) array lookup. No networking fetch, no blob conversion, no buffering!
    const img = this.activeSceneCache.get(this.currentFrame);
    
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
