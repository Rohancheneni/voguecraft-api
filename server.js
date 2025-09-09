const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 8080;
const MODE = process.env.MODE || 'MOCK';
const MOCK_IMAGE_PATH = process.env.MOCK_IMAGE_PATH || 'mock-samples/sample1.png';
const MODEL_URL = process.env.MODEL_URL || null;

app.use(cors());

// Health check
app.get('/healthz', (req, res) => {
  res.json({ ok: true, mode: MODE });
});

// Debug endpoint to check the mock image
app.get('/mock-image', (req, res) => {
  try {
    const resolved = path.resolve(process.cwd(), MOCK_IMAGE_PATH);
    console.log('DEBUG [/mock-image]: trying to read', resolved);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ ok: false, error: 'Mock image not found at ' + resolved });
    }
    const stat = fs.statSync(resolved);
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': stat.size });
    fs.createReadStream(resolved).pipe(res);
  } catch (err) {
    console.error('DEBUG [/mock-image]: error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Main generate endpoint
app.post('/api/generate', upload.fields([{ name: 'person' }, { name: 'cloth' }]), async (req, res) => {
  try {
    console.log('DEBUG: Running in MODE=', MODE);
    console.log('DEBUG: MOCK_IMAGE_PATH=', MOCK_IMAGE_PATH);
    console.log('DEBUG: process.cwd()=', process.cwd());

    try {
      console.log('DEBUG: Files in cwd:', fs.readdirSync(process.cwd()));
      console.log('DEBUG: Files in mock-samples:', fs.readdirSync(path.join(process.cwd(), 'mock-samples')));
    } catch (e) {
      console.error('DEBUG: Could not list files in mock-samples:', e.message);
    }

    if (MODE === 'MOCK') {
      const resolved = path.resolve(process.cwd(), MOCK_IMAGE_PATH);
      console.log('DEBUG: resolved mock path=', resolved);

      if (!fs.existsSync(resolved)) {
        console.error('DEBUG: mock image missing at', resolved);
        return res.status(500).json({ ok: false, error: 'Mock image not found: ' + resolved });
      }

      const stat = fs.statSync(resolved);
      console.log('DEBUG: streaming mock image size=', stat.size, 'bytes');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': stat.size });
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    if (!MODEL_URL) {
      return res.status(500).json({ ok: false, error: 'MODEL_URL not configured' });
    }
    if (!req.files || !req.files.person || !req.files.cloth) {
      return res.status(400).json({ ok: false, error: 'person and cloth files required' });
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
    console.error('DEBUG: error in /api/generate', err);
    res.status(500).json({
      ok: false,
      error: (err.response && err.response.data) ? err.response.data : (err.message || 'server error')
    });
  } finally {
    try {
      if (req && req.files) Object.values(req.files).flat().forEach(f => fs.unlinkSync(f.path));
    } catch (e) {}
  }
});

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
  setTimeout(() => process.exit(1), 1000);
});

app.listen(PORT, () => {
  console.log('Listening on', PORT, 'MODE=', MODE);
});



