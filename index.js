const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const ProgressBar = require('progress');

async function downloadFile(url, filename) {
  const downloadsDir = path.join(os.homedir(), 'Downloads', 'ArslanerDownloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const outputPath = path.join(downloadsDir, filename);
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  const totalLength = response.headers['content-length'];
  const progressBar = new ProgressBar('⬇️ [:bar] :percent :etas', {
    width: 40,
    complete: '=',
    incomplete: ' ',
    total: parseInt(totalLength)
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.on('data', (chunk) => progressBar.tick(chunk.length));
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', (err) => reject(err));
  });
}

module.exports = { downloadFile };
