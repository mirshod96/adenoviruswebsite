export class AudioManager {
  constructor() {
    this.ctx = null;
    this.nodes = {};
    
    // Procedural sync states
    this.isMuted = true;
    this.currentScene = 1;
    this.lastFrame = 0;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.isMuted = false;
    
    // Start generating absolute background noise
    this.setupDrone();
  }

  setupDrone() {
     this.nodes.droneOsc1 = this.ctx.createOscillator();
     this.nodes.droneOsc2 = this.ctx.createOscillator();
     
     this.nodes.droneOsc1.type = 'sawtooth';
     this.nodes.droneOsc2.type = 'square';
     
     this.nodes.droneOsc1.frequency.value = 55; // Sub-bass fundamental A1
     this.nodes.droneOsc2.frequency.value = 54.5;
     
     this.nodes.droneFilter = this.ctx.createBiquadFilter();
     this.nodes.droneFilter.type = 'lowpass';
     this.nodes.droneFilter.frequency.value = 100; // Will be scaled by user scroll interaction!
     this.nodes.droneFilter.Q.value = 1.5;
     
     this.nodes.droneGain = this.ctx.createGain();
     this.nodes.droneGain.gain.value = 0.5; // Raised master Drone dB for immediate phone speaker audibility
     
     // Hardware Master
     this.nodes.masterGain = this.ctx.createGain();
     this.nodes.masterGain.gain.value = 1.0;
     
     this.nodes.droneOsc1.connect(this.nodes.droneFilter);
     this.nodes.droneOsc2.connect(this.nodes.droneFilter);
     this.nodes.droneFilter.connect(this.nodes.droneGain);
     this.nodes.droneGain.connect(this.nodes.masterGain);
     this.nodes.masterGain.connect(this.ctx.destination);
     
     this.nodes.droneOsc1.start();
     this.nodes.droneOsc2.start();
  }

  // Constantly updated mathematically through GSAP loop
  syncToFrame(sceneNum, frame, velocity) {
     if (!this.ctx || this.isMuted) return;
     
     // 1. Modulate background drone dynamically based on scroll velocity!
     const absVel = Math.abs(velocity);
     // Base frequency 100Hz, expands up to 1400Hz giving an atmospheric 'Whoosh' simply from scrolling faster
     const targetFreq = 100 + Math.min(absVel * 1.8, 1300);
     
     if (this.nodes.droneFilter) {
         this.nodes.droneFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
     }
     
     // 2. Transpose structural drone chord key upon shifting to new visual sections
     if (this.currentScene !== sceneNum) {
         this.changeSceneVibe(sceneNum);
         this.currentScene = sceneNum;
     }

     // 3. Eject precise high-tech sound elements synchronized exactly down to the frame
     if (Math.abs(frame - this.lastFrame) > 0) {
         this.checkFrameEvents(sceneNum, frame, velocity);
         this.lastFrame = frame;
     }
  }

  changeSceneVibe(sceneNum) {
      if (!this.ctx || !this.nodes.droneOsc1) return;
      
      const freqs = [55, 65.41, 73.42, 82.41, 65.41, 55, 98, 49, 110, 55, 123.47, 55];
      const target = freqs[(sceneNum - 1) % freqs.length] || 55;
      
      this.nodes.droneOsc1.frequency.setTargetAtTime(target, this.ctx.currentTime, 1.0);
      this.nodes.droneOsc2.frequency.setTargetAtTime(target - 0.5, this.ctx.currentTime, 1.0);
      
      this.playSwoosh();
  }

  checkFrameEvents(sceneNum, frame, vel) {
      // Procedural trigger: Send high pitch Sci-Fi telemetry pings on rigid 30 frame intervals while moving
      if (frame % 30 === 0 && Math.abs(vel) > 10) {
          this.playTelemetryBeep();
      }
      
      // Procedural trigger: Strike dramatic rhythmic baseline pulses at key visual markers
      if (frame === 20 || frame === 80) {
          this.playHeartbeat();
      }
  }

  playSwoosh() {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(100, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(3000, this.ctx.currentTime + 1.0);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.nodes.masterGain);
      
      noise.start();
  }

  playTelemetryBeep() {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 + Math.random() * 800, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(this.nodes.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
  }

  playHeartbeat() {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(this.nodes.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
  }

  async toggleMute() {
    if (!this.ctx) this.init();
    
    // STRICT iOS BYPASS: AudioContext must be explicitly resumed upon user tap
    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
    
    this.isMuted = !this.isMuted;
    
    const targetVolume = this.isMuted ? 0 : 1.0;
    
    if (this.nodes.masterGain) {
         this.nodes.masterGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.1);
    }
  }
}
