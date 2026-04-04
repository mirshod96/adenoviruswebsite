export class AudioManager {
  constructor(soundBaseDir = '/sound/') {
    this.soundBaseDir = soundBaseDir;
    this.ctx = null;
    this.isMuted = true;
    this.trackBuffers = {}; // Object mapping sceneNum to { forward, reverse, duration }
    
    this.currentScene = null;
    this.currentSource = null;
    this.currentGain = null;
    this.isReversing = false;
    this.masterGainNode = null;

    this.toggleBtn = document.getElementById('audio-toggle');
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleAudio());
    }

    // Radical Fetch: Pre-warm the buffer streams blindly
    setTimeout(() => {
        this.loadSceneAudio(1);
        this.loadSceneAudio(2);
    }, 1500);
  }

  async init() {
     if (!this.ctx) {
         this.ctx = new (window.AudioContext || window.webkitAudioContext)();
         this.masterGainNode = this.ctx.createGain();
         this.masterGainNode.gain.value = this.isMuted ? 0 : 0.8;
         this.masterGainNode.connect(this.ctx.destination);

         // iOS Unlock Pattern: Play silent oscillator synchronously inside the tap event stack
         const unlockOsc = this.ctx.createOscillator();
         unlockOsc.connect(this.ctx.destination);
         unlockOsc.start(0);
         unlockOsc.stop(this.ctx.currentTime + 0.001);
     }
     if (this.ctx.state === 'suspended') {
         this.ctx.resume().catch(()=>{});
     }

     // Radical Global Unblocker: Bind tap listeners unconditionally
     const globalUnlock = () => {
         if (this.ctx && this.ctx.state === 'suspended') {
             this.ctx.resume().catch(()=>{});
         }
     };
     document.addEventListener('touchstart', globalUnlock, { passive: true });
     document.addEventListener('touchend', globalUnlock, { passive: true });
     document.addEventListener('click', globalUnlock, { passive: true });
  }

  async toggleAudio() {
    await this.init();
    this.isMuted = !this.isMuted;
    
    if (this.masterGainNode) {
        this.masterGainNode.gain.setTargetAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime, 0.1);
    }

    if (this.isMuted) {
      if (this.toggleBtn) this.toggleBtn.querySelector('.icon').textContent = '🔈';
    } else {
      if (this.toggleBtn) this.toggleBtn.querySelector('.icon').textContent = '🔊';
    }
  }

  async loadSceneAudio(sceneNum) {
      if (this.trackBuffers[sceneNum]) return;
      this.trackBuffers[sceneNum] = 'loading'; 

      try {
          const response = await fetch(`${this.soundBaseDir}${sceneNum}-scene.mp3`);
          const arrayBuffer = await response.arrayBuffer();
          // We MUST ensure ctx is spun up to decode raw binaries
          if (!this.ctx) await this.init();
          
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          
          // Physically manipulate memory for a true reverse audio sequence boundary
          const reverseBuffer = this.ctx.createBuffer(
              audioBuffer.numberOfChannels, 
              audioBuffer.length, 
              audioBuffer.sampleRate
          );
          
          for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
              const dest = reverseBuffer.getChannelData(i);
              const src = audioBuffer.getChannelData(i);
              const totalLen = audioBuffer.length;
              for (let j = 0; j < totalLen; j++) {
                  dest[j] = src[totalLen - 1 - j];
              }
          }
          
          this.trackBuffers[sceneNum] = {
              forward: audioBuffer,
              reverse: reverseBuffer,
              duration: audioBuffer.duration
          };
      } catch(e) {
          console.error("Failed to load or reverse audio", e);
          this.trackBuffers[sceneNum] = null;
      }
  }

  // Driven completely mathematically by GSAP engine frame clocks to ensure precision
  syncAudioToFrame(sceneNum, frame, totalFrames, velocity) {
      if (this.isMuted || !this.ctx) return;
      
      const buffers = this.trackBuffers[sceneNum];
      
      // If uninitialized, strictly fetch and build the binary inversion asynchronously 
      if (!buffers) {
          this.loadSceneAudio(sceneNum);
          return;
      }
      if (buffers === 'loading') return;

      const goingBackwards = velocity < -5; 
      const goingForwards = velocity > 5;
      let targetReverse = this.isReversing;

      if (goingBackwards) targetReverse = true;
      if (goingForwards) targetReverse = false;

      // Swap streams dynamically based on GSAP scrub directional vectors
      const needNewSource = (this.currentScene !== sceneNum) || 
                            (!this.currentSource) || 
                            (this.isReversing !== targetReverse);

      if (needNewSource) {
          if (this.currentSource) {
              const oldGain = this.currentGain;
              if (oldGain) {
                  oldGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
                  const oldSource = this.currentSource;
                  setTimeout(() => { try { oldSource.stop() } catch(e){} }, 200);
              }
          }
          
          this.currentScene = sceneNum;
          this.isReversing = targetReverse;

          let fraction = frame / totalFrames;
          fraction = Math.max(0, Math.min(1, fraction));
          
          let startOffset = 0;
          if (this.isReversing) {
               // Crossfade the physical head of play mathematically inversely across standard bounds limits
               startOffset = (1 - fraction) * buffers.duration;
          } else {
               startOffset = fraction * buffers.duration;
          }
          
          const source = this.ctx.createBufferSource();
          source.buffer = this.isReversing ? buffers.reverse : buffers.forward;
          
          const gainNode = this.ctx.createGain();
          gainNode.gain.value = 0.01;
          gainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.05); // 50ms curve smooths all switching entirely 
          
          source.connect(gainNode);
          gainNode.connect(this.masterGainNode);
          
          source.start(0, startOffset);
          
          this.currentSource = source;
          this.currentGain = gainNode;
      }
  }

  // Fallbacks protecting ScrollManager legacy triggers
  playSceneAudio() {} 
}
