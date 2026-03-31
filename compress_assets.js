import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scenesDir = path.join(__dirname, 'public', 'scenes');

async function processImages() {
  console.log('Starting Asset Compression Sweep...');
  const scenes = fs.readdirSync(scenesDir).filter(f => /^\d+-scene$/.test(f));
  
  let totalSaved = 0;
  let fileCount = 0;

  for (const scene of scenes) {
    const scenePath = path.join(scenesDir, scene);
    const files = fs.readdirSync(scenePath).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
    
    console.log(`Processing ${scene} - ${files.length} frames...`);
    
    // Process frames in chunks to prevent memory overhead and speed up I/O
    const chunkSize = 25;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (file) => {
        const inputPath = path.join(scenePath, file);
        // Replace .jpg suffix with .webp suffix
        const outName = file.replace(/\.jpe?g$/i, '.webp');
        const outputPath = path.join(scenePath, outName);
        
        try {
          // Sharp fast track execution mapping WebP properties
          // Quality 85 balances 10-15x space savings vs perceptual loss
          await sharp(inputPath)
            .webp({ quality: 85, nearLossless: false })
            .toFile(outputPath);
            
          const originalSize = fs.statSync(inputPath).size;
          const newSize = fs.statSync(outputPath).size;
          
          totalSaved += (originalSize - newSize);
          fileCount++;
          
          // Delete original to save space
          fs.unlinkSync(inputPath);
        } catch (err) {
          console.error(`Failed compressing ${file} in ${scene}:`, err);
        }
      }));
    }
  }

  const savedMB = (totalSaved / (1024 * 1024)).toFixed(2);
  console.log(`✅ Compression complete! Processed ${fileCount} images.`);
  console.log(`🚀 Saved a massive ${savedMB} MB from your project directory!`);
}

processImages().catch(console.error);
