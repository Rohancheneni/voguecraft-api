const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');

const upload = multer({ dest: '/tmp' });
const app = express();

app.use(cors({ origin: ['https://voguecraft-site-zkxp4c8m2-rohan-chenenis-projects.vercel.app','https://voguecraft.io','http://localhost:8000','*'] }));

const MODE = (process.env.MODE || 'MOCK').toUpperCase();
const MODEL_URL = process.env.MODEL_URL || '';
const MOCK_IMAGE_PATH = process.env.MOCK_IMAGE_PATH || './mock-samples/sample1.png';
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.status(404).send('Cannot GET /'));
app.get('/healthz', (req, res) => res.json({ ok: true, mode: MODE }));

function logError(err) {
  console.error('ERROR:', err && (err.stack || err.message || err));
}

app.post('/api/generate', upload.fields([{name:'person'},{name:'cloth'}]), async (req, res) => {
  try {
    if (MODE === 'MOCK') {
      const resolved = path.resolve(process.cwd(), MOCK_IMAGE_PATH);
      console.log('DEBUG: MODE=MOCK, MOCK_IMAGE_PATH=', MOCK_IMAGE_PATH, 'resolved=', resolved);
      if (!fs.existsSync(resolved)) {
        console.error('DEBUG: mock image missing at', resolved);
        return res.status(500).json({ ok:false, error: 'Mock image not found: ' + resolved });
      }
      const stat = fs.statSync(resolved);
      console.log('DEBUG: streaming mock image size=', stat.size, 'bytes');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': stat.size
      });
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    if (!MODEL_URL) {
      return res.status(500).json({ ok:false, error: 'MODEL_URL not configured' });
    }
    if (!req.files || !req.files.person || !req.files.cloth) {
      return res.status(400).json({ ok:false, error: 'person and cloth files required' });
    }

    const form = new FormData();
    form.append('person', fs.createReadStream(req.files.person[0].path), req.files.person[0].originalname);
    form.append('cloth', fs.createReadStream(req.files.cloth[0].path), req.files.cloth[0].originalname);

    const resp = await axios.post(MODEL_URL, form, {
      headers: { ...form.getHeaders() },
      responseType: 'arraybuffer',
      timeout: 5 * 60 * 1000,
      maxContentLength: 200 * 1024 * 1024
    });

    res.setHeader('Content-Type', resp.headers['content-type'] || 'image/png');
    res.send(Buffer.from(resp.data));
  } catch (err) {
    logError(err);
    res.status(500).json({ ok:false, error: (err.response && err.response.data) ? err.response.data : (err.message || 'server error') });
  } finally {
    try { if (req && req.files) Object.values(req.files).flat().forEach(f => fs.unlinkSync(f.path)); } catch(e){}
  }
});

process.on('uncaughtException', (err) => {
  logError('uncaughtException: ' + (err && err.stack ? err.stack : err));
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason) => {
  logError('unhandledRejection: ' + (reason && reason.stack ? reason.stack : reason));
  setTimeout(() => process.exit(1), 1000);
});

app.listen(PORT, () => {
  console.log('Listening on', PORT, 'MODE=', MODE);
});
