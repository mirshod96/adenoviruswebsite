import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenesDir = path.join(__dirname, 'public', 'vaccine_box_scenes');
const metadata = {};

// We have 5 scenes natively
const scenes = fs.readdirSync(scenesDir).filter(f => /^\d+-scene$/.test(f));
for (const scene of scenes) {
  const scenePath = path.join(scenesDir, scene);
  const files = fs.readdirSync(scenePath).filter(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
  files.sort();
  metadata[scene] = files;
}

fs.writeFileSync(path.join(__dirname, 'public', 'vaccine_meta.json'), JSON.stringify(metadata, null, 2));
console.log('Vaccine Metadata generated referencing 5 scenes successfully!');
