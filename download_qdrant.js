const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const binPath = path.join(__dirname, 'resources', 'bin');
if (!fs.existsSync(binPath)) {
    fs.mkdirSync(binPath, { recursive: true });
}

const qdrantUrl = 'https://github.com/qdrant/qdrant/releases/latest/download/qdrant-x86_64-pc-windows-msvc.zip';
const zipPath = path.join(binPath, 'qdrant.zip');

console.log('Downloading Qdrant from:', qdrantUrl);

const file = fs.createWriteStream(zipPath);
https.get(qdrantUrl, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
        console.log('Redirecting to:', response.headers.location);
        https.get(response.headers.location, (res) => {
             res.pipe(file);
             file.on('finish', () => {
                file.close(() => {
                    console.log('Download completed.');
                    extract();
                });
             });
        });
    } else {
        response.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                console.log('Download completed.');
                extract();
            });
        });
    }
}).on('error', (err) => {
    fs.unlink(zipPath);
    console.error('Error downloading:', err.message);
});

function extract() {
    console.log('Extracting...');
    const cmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binPath}' -Force"`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log('Extracted successfully.');
        fs.unlinkSync(zipPath);
        console.log('Zip file removed.');
    });
}
