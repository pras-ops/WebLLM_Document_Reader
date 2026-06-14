const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function zipDirectory(sourceDir, outPath) {
  const zip = new JSZip();
  
  function addFiles(dir, zipFolder) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const subFolder = zipFolder.folder(file);
        addFiles(fullPath, subFolder);
      } else {
        const fileContent = fs.readFileSync(fullPath);
        zipFolder.file(file, fileContent);
      }
    }
  }

  console.log(`Zipping directory: ${sourceDir}`);
  addFiles(sourceDir, zip);
  
  console.log(`Generating ZIP file at: ${outPath}`);
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  
  fs.writeFileSync(outPath, content);
  console.log('Successfully created extension.zip!');
}

const source = path.resolve(__dirname, '../dist');
const dest = path.resolve(__dirname, '../extension.zip');
zipDirectory(source, dest).catch(console.error);
