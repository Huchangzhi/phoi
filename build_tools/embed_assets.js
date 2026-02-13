const fs = require('fs');
const path = require('path');

// Function to convert file to base64
function fileToBase64(filepath) {
    const bitmap = fs.readFileSync(filepath);
    return Buffer.from(bitmap).toString('base64');
}

// Function to escape special characters in text files
function escapeSpecialChars(str) {
    return str
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/\`/g, '\\`')    // Escape backticks
        .replace(/\$/g, '\\$')    // Escape dollar signs
        .replace(/\n/g, '\\n')    // Escape newlines
        .replace(/\r/g, '\\r')    // Escape carriage returns
        .replace(/\t/g, '\\t');   // Escape tabs
}

// Read all static files and convert them to embedded content
const staticDir = path.join(__dirname, '..', 'static');
const workerTemplatePath = path.join(__dirname, '..', 'worker', 'index.js');
const workerOutputPath = path.join(__dirname, '..', 'worker', 'index.js');

// Read the template worker file
let workerCode = fs.readFileSync(workerTemplatePath, 'utf8');

// Process each static file
const files = fs.readdirSync(staticDir);
let assetsCode = 'const ASSETS = {\n';

files.forEach(file => {
    const filepath = path.join(staticDir, file);
    const stat = fs.statSync(filepath);
    
    if (stat.isDirectory()) {
        // Handle subdirectories recursively
        const subfiles = fs.readdirSync(filepath);
        subfiles.forEach(subfile => {
            const subfilepath = path.join(filepath, subfile);
            const substat = fs.statSync(subfilepath);
            
            if (!substat.isDirectory()) {
                const assetPath = `/static/${file}/${subfile}`;
                const ext = path.extname(subfile).toLowerCase();
                
                if (ext === '.css' || ext === '.js' || ext === '.html' || ext === '.txt') {
                    // Text file - read as string and escape special chars
                    const content = fs.readFileSync(subfilepath, 'utf8');
                    assetsCode += `  "${assetPath}": {\n`;
                    assetsCode += `    content: \`${escapeSpecialChars(content)}\`,\n`;
                    assetsCode += `    contentType: "${getContentType(ext)}"\n`;
                    assetsCode += `  },\n`;
                } else {
                    // Binary file - convert to base64
                    const base64 = fileToBase64(subfilepath);
                    assetsCode += `  "${assetPath}": {\n`;
                    assetsCode += `    content: "${base64}",\n`;
                    assetsCode += `    contentType: "${getContentType(ext)}",\n`;
                    assetsCode += `    isBinary: true\n`;
                    assetsCode += `  },\n`;
                }
            }
        });
    } else {
        // Regular file
        const assetPath = `/static/${file}`;
        const ext = path.extname(file).toLowerCase();
        
        if (ext === '.css' || ext === '.js' || ext === '.html' || ext === '.txt') {
            // Text file - read as string and escape special chars
            const content = fs.readFileSync(filepath, 'utf8');
            assetsCode += `  "${assetPath}": {\n`;
            assetsCode += `    content: \`${escapeSpecialChars(content)}\`,\n`;
            assetsCode += `    contentType: "${getContentType(ext)}"\n`;
            assetsCode += `  },\n`;
        } else {
            // Binary file - convert to base64
            const base64 = fileToBase64(filepath);
            assetsCode += `  "${assetPath}": {\n`;
            assetsCode += `    content: "${base64}",\n`;
            assetsCode += `    contentType: "${getContentType(ext)}",\n`;
            assetsCode += `    isBinary: true\n`;
            assetsCode += `  },\n`;
        }
    }
});

assetsCode += '};\n';

// Replace the ASSETS section in the worker code
const startMarker = '// Static assets map';
const endMarker = '// Main fetch handler';
const startIndex = workerCode.indexOf(startMarker);
const endIndex = workerCode.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const beforeAssets = workerCode.substring(0, startIndex + startMarker.length);
    const afterAssets = workerCode.substring(endIndex);
    
    workerCode = beforeAssets + '\n' + assetsCode + '\n' + afterAssets;
}

// Write the updated worker code
fs.writeFileSync(workerOutputPath, workerCode);
console.log('Worker code updated with static assets.');

// Helper function to determine content type
function getContentType(ext) {
    switch (ext) {
        case '.css':
            return 'text/css';
        case '.js':
            return 'application/javascript';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.svg':
            return 'image/svg+xml';
        case '.html':
            return 'text/html';
        case '.json':
            return 'application/json';
        case '.txt':
            return 'text/plain';
        case '.ico':
            return 'image/x-icon';
        default:
            return 'application/octet-stream';
    }
}