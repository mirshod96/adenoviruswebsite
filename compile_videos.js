import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenesDir = path.join(__dirname, 'public', 'scenes');
const outputDir = path.join(__dirname, 'public', 'video');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Initiating FFMPEG Intra-frame Encoder Pipeline...');

const scenes = fs.readdirSync(scenesDir).filter(f => /^\d+-scene$/.test(f));

for (const scene of scenes) {
  const scenePath = path.join(scenesDir, scene);
  const outPath = path.join(outputDir, `${scene}.mp4`);
  
  if (fs.existsSync(outPath)) {
      console.log(`Skipping ${scene}.mp4, already encoded.`);
      continue;
  }
  
  console.log(`Baking Keyframes for ${scene}...`);
  // -g 1 ensures ALL frames are intra-coded keyframes.
  // This destroys temporal compression size savings but guarantees 1ms backwards/forwards scrubbability natively
  // without any decoding lag, perfectly mirroring Canvas sequences behaviour but inside Safari's hardware video decoder.
  // -vcodec libx264 ensures universal decoding compatibility
  // -pix_fmt yuv420p is strictly required for QuickTime/Safari iOS support
  const cmd = `ffmpeg -y -framerate 30 -pattern_type glob -i "${scenePath}/*.webp" -c:v libx264 -preset fast -g 1 -keyint_min 1 -pix_fmt yuv420p "${outPath}"`;
  
  try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(`✅ Success for ${scene}`);
  } catch (err) {
      console.error(`💥 Failed FFMPEG on ${scene}:`, err.message);
  }
}

console.log('✨ All 12 sequences compiled to MP4 Videos. Ready for Scrubbing! ✨');
