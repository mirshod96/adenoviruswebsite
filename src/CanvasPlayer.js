export class CanvasPlayer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { alpha: false }); // Better performance if we don't need transparency
    
    this.scenesMeta = null;
    this.imageCache = new Map(); // sceneIndex -> Map(frameIndex -> Image)
    
    this.currentScene = 1;
    this.currentFrame = 0;
    this.targetScene = 1;
    this.targetFrame = 0;
    
    this.isRendering = false;
    
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
  }

  async loadMetadata() {
    try {
      const res = await fetch('/scenes_meta.json');
      this.scenesMeta = await res.json();
      
      // Extract available scenes and eager load the first frame of every existing scene
      for (const sceneKey of Object.keys(this.scenesMeta)) {
        const sceneNum = parseInt(sceneKey.split('-')[0]);
        this.loadFrame(sceneNum, 0); // Eagerly load the cover frame
      }
    } catch (err) {
      console.error('Error loading scenes metadata:', err);
    }
  }

  async preloadCriticalFrames(onProgress) {
    if (!this.scenesMeta) return;

    const sceneNum = 1;
    // We preload up to 70 frames to ensure absolute smoothness when button is clicked
    const targetCount = Math.min(70, this.getFrameCount(sceneNum));
    let loaded = 0;

    return new Promise((resolve) => {
      const checkDone = () => {
        loaded++;
        onProgress(Math.round((loaded / targetCount) * 100));
        if (loaded >= targetCount) resolve();
      };

      for (let i = 0; i < targetCount; i++) {
        const img = this.loadFrame(sceneNum, i);
        if (!img) {
          checkDone();
          continue;
        }

        if (img.complete) {
          checkDone();
        } else {
          img.onload = checkDone;
          img.onerror = checkDone; // Fail gracefully so it doesn't block forever
        }
      }
    });
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    
    // Scale ctx down to match CSS units internally
    this.ctx.scale(dpr, dpr);
    
    // Force a re-render right now
    this.renderCurrentFrame();
  }

  getFrameCount(sceneNum) {
    if (!this.scenesMeta) return 0;
    const sceneKey = `${sceneNum}-scene`;
    return this.scenesMeta[sceneKey] ? this.scenesMeta[sceneKey].length : 0;
  }

  loadFrame(sceneNum, frameIndex) {
    if (!this.scenesMeta) return null;
    const sceneKey = `${sceneNum}-scene`;
    if (!this.scenesMeta[sceneKey] || frameIndex >= this.scenesMeta[sceneKey].length) return null;

    if (!this.imageCache.has(sceneNum)) {
      this.imageCache.set(sceneNum, new Map());
    }
    const sceneCache = this.imageCache.get(sceneNum);

    if (sceneCache.has(frameIndex)) {
      return sceneCache.get(frameIndex);
    }

    const img = new Image();
    // Use the actual filename from metadata
    const fileName = this.scenesMeta[sceneKey][frameIndex];
    img.src = `/scenes/${sceneKey}/${fileName}`;
    img.decode().catch(() => {}); // Decode asynchronously for performance
    
    sceneCache.set(frameIndex, img);
    return img;
  }

  // Preloads N upcoming frames to reduce stutter
  preloadUpcoming(sceneNum, startFrame, count = 20) {
    const total = this.getFrameCount(sceneNum);
    for (let i = startFrame; i < startFrame + count && i < total; i++) {
        this.loadFrame(sceneNum, i);
    }
  }

  setFrame(sceneNum, frameIndex) {
    this.targetScene = sceneNum;
    this.targetFrame = Math.floor(frameIndex);
    
    // Begin preload buffer
    this.preloadUpcoming(sceneNum, this.targetFrame, 15);
    
    if (!this.isRendering) {
      this.isRendering = true;
      requestAnimationFrame(() => this.renderLoop());
    }
  }

  renderLoop() {
    this.currentScene = this.targetScene;
    this.currentFrame = this.targetFrame;
    
    this.renderCurrentFrame();
    
    // Just a fast pass single frame sync. 
    // Wait for next explicit event to stop render loop.
    this.isRendering = false;
  }

  renderCurrentFrame() {
    const img = this.loadFrame(this.currentScene, this.currentFrame);
    
    if (!img) return; // Wait for load
    
    if (img.complete && img.naturalWidth > 0) {
      this.drawCover(img);
    } else {
      img.onload = () => {
        // Only draw if it's still the requested frame
        if (this.currentScene === this.targetScene && this.currentFrame === this.targetFrame) {
            this.drawCover(img);
        }
      };
    }
  }

  // Draws image simulating CSS object-fit: cover
  drawCover(img) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    
    const scale = Math.max(w / iw, h / ih);
    
    const dx = (w - (iw * scale)) / 2;
    const dy = (h - (ih * scale)) / 2;
    
    this.ctx.fillRect(0, 0, w, h); // clear with fallback color implicitly from background style
    this.ctx.drawImage(img, dx, dy, iw * scale, ih * scale);
  }
}
