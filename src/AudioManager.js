import { Howl, Howler } from 'howler';

export class AudioManager {
  constructor() {
    this.isMuted = true;
    this.audioTracks = {};
    this.currentTrack = null;
    
    // Load the 12 scene mp3s
    for (let i = 1; i <= 12; i++) {
       this.audioTracks[i] = new Howl({
          src: [`/sound/${i}-scene.mp3`],
          preload: true,
          volume: 0.8,
          loop: false
       });
    }

    this.toggleBtn = document.getElementById('audio-toggle');
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleAudio());
    }
    
    // Start muted to comply with browser autoplay policies until user interacts
    Howler.mute(this.isMuted);
  }

  toggleAudio() {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    
    if (this.isMuted) {
      this.toggleBtn.querySelector('.icon').textContent = '🔈';
    } else {
      this.toggleBtn.querySelector('.icon').textContent = '🔊';
      
      // If unmuted, make sure the current track starts playing
      if (this.currentTrack && !this.audioTracks[this.currentTrack].playing()) {
         this.audioTracks[this.currentTrack].play();
      }
    }
  }

  playSceneAudio(sceneNum) {
    if (this.currentTrack === sceneNum) return;
    
    const previousTrack = this.currentTrack;
    this.currentTrack = sceneNum;
    
    // Crossfade out the old track
    if (previousTrack && this.audioTracks[previousTrack] && this.audioTracks[previousTrack].playing()) {
      this.audioTracks[previousTrack].fade(0.8, 0, 500);
      setTimeout(() => {
        if (this.currentTrack !== previousTrack) { // Check that we didn't rapidly scroll back
          this.audioTracks[previousTrack].stop();
        }
      }, 500);
    }
    
    // Play the new track
    if (this.audioTracks[sceneNum]) {
      this.audioTracks[sceneNum].volume(0);
      this.audioTracks[sceneNum].play();
      this.audioTracks[sceneNum].fade(0, 0.8, 500);
    }
  }

  playTick() {
    // Legacy stub, no longer needed as we have full scene tracks
  }
}
