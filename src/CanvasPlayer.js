export class CanvasPlayer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
    this.scenesMeta = null;
    this.imageCache = new Map();

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

  async preloadCriticalFrames(onProgress) {
    if (!this.scenesMeta) return;

    const sceneNum = 1;
    // Preload extremely aggressively strictly for the crucial first initial animation run
    const targetCount = Math.min(60, this.getFrameCount(sceneNum));
    let loaded = 0;

    return new Promise((resolve) => {
      const checkDone = () => {
        loaded++;
        onProgress(Math.round((loaded / targetCount) * 100));
        if (loaded >= targetCount) resolve();
      };

      for (let i = 0; i < targetCount; i++) {
         this.loadBlobFrame(sceneNum, i, checkDone);
      }
    });
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    
    // Attempt redraw immediately
    if (!this.isRendering && this.scenesMeta) this.renderCurrentFrame();
  }

  getFrameCount(sceneNum) {
    const key = `${sceneNum}-scene`;
    if (!this.scenesMeta || !this.scenesMeta[key]) return 0;
    return this.scenesMeta[key].length;
  }

  // Purely loads bitmapped GPU slices without DOM leakage bounds
  loadBlobFrame(sceneNum, frameIndex, onCompleteFallback = null) {
    const sceneKey = `${sceneNum}-scene`;
    if (!this.scenesMeta || !this.scenesMeta[sceneKey]) {
        if (onCompleteFallback) onCompleteFallback();
        return null;
    }
    
    if (frameIndex >= this.scenesMeta[sceneKey].length) {
        if (onCompleteFallback) onCompleteFallback();
        return null;
    }

    if (!this.imageCache.has(sceneKey)) {
      this.imageCache.set(sceneKey, new Map());
    }
    const sceneCache = this.imageCache.get(sceneKey);

    if (sceneCache.has(frameIndex)) {
      const obj = sceneCache.get(frameIndex);
      if (obj.state === 'ready' && obj.bitmap && onCompleteFallback) {
         onCompleteFallback();
      }
      return obj;
    }

    const fileName = this.scenesMeta[sceneKey][frameIndex];
    const url = `/scenes/${sceneKey}/${fileName}`;
    
    const frameObj = { state: 'loading', bitmap: null };
    sceneCache.set(frameIndex, frameObj);

    // Stream blob processing bypasses standard browser Image DOM memory leak queues completely
    fetch(url)
      .then(res => {
         if (!res.ok) throw new Error("HTTP error " + res.status);
         return res.blob();
      })
      .then(blob => createImageBitmap(blob))
      .then(bitmap => {
         // Is it still relevant/in cache? Or did we GC this while it was fetching?
         if (sceneCache.has(frameIndex)) {
            frameObj.state = 'ready';
            frameObj.bitmap = bitmap;
            if (onCompleteFallback) onCompleteFallback();
            
            // Critical async drawing sync
            if (this.currentScene === sceneNum && this.currentFrame === frameIndex) {
                 this.drawCover(bitmap);
            }
         } else {
            // Memory was flushed during fetch loop (scrolled too fast!) — nuke it synchronously from GPU.
            bitmap.close();
            if (onCompleteFallback) onCompleteFallback();
         }
      })
      .catch(err => {
         frameObj.state = 'error';
         if (onCompleteFallback) onCompleteFallback();
      });

    return frameObj;
  }

  setFrame(sceneNum, frameIndex) {
    this.targetScene = sceneNum;
    this.targetFrame = Math.floor(frameIndex);
    
    // Explicit forward caching sweep ensuring buttery frames down the wire
    this.preloadUpcoming(sceneNum, this.targetFrame, 18);
    
    // Ruthless GPU Memory Wipe preventing Safari crashes dynamically
    this.garbageCollect(this.targetScene, this.targetFrame);
    
    if (!this.isRendering) {
      this.isRendering = true;
      requestAnimationFrame(() => this.renderLoop());
    }
  }

  preloadUpcoming(sceneNum, startFrame, count) {
    const total = this.getFrameCount(sceneNum);
    for (let i = startFrame; i < startFrame + count && i < total; i++) {
        this.loadBlobFrame(sceneNum, i);
    }
  }

  garbageCollect(activeScene, activeFrame) {
    const buffer = 45; // Strictly allow only 45 frames left-or-right to exist in memory
    const activeSceneKey = `${activeScene}-scene`;
    
    for (const [sKey, sceneMap] of this.imageCache.entries()) {
      for (const [fKey, obj] of sceneMap.entries()) {
        // Retain 0 index for background/pause rendering fallback
        if (fKey === 0) continue;
        
        if (sKey !== activeSceneKey || Math.abs(fKey - activeFrame) > buffer) {
             if (obj.state === 'ready' && obj.bitmap) {
                 // Synchronously instantly removes bitmap from GPU hardware! No lingering JS dependencies.
                 obj.bitmap.close(); 
             }
             sceneMap.delete(fKey);
        }
      }
    }
  }

  renderLoop() {
    this.currentScene = this.targetScene;
    this.currentFrame = this.targetFrame;
    
    this.renderCurrentFrame();
    
    this.isRendering = false;
  }

  renderCurrentFrame() {
    const obj = this.loadBlobFrame(this.currentScene, this.currentFrame);
    
    if (!obj || obj.state !== 'ready' || !obj.bitmap) return; // Drawn asynchronously dynamically
    
    this.drawCover(obj.bitmap);
  }

  drawCover(bitmap) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    const iw = bitmap.width;
    const ih = bitmap.height;
    
    const scale = Math.max(w / iw, h / ih);
    
    const dx = (w - (iw * scale)) / 2;
    const dy = (h - (ih * scale)) / 2;
    
    this.ctx.fillRect(0, 0, w, h); 
    this.ctx.drawImage(bitmap, dx, dy, iw * scale, ih * scale);
  }
}
