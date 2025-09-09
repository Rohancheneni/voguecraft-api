const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 8080;
const MODE = process.env.MODE || 'MOCK';
const MODEL_URL = process.env.MODEL_URL || null;

// Health check
app.get('/healthz', (req, res) => {
  res.json({ ok: true, mode: MODE });
});

// Quick mock test route
app.get('/mock-image', (req, res) => {
  const resolved = path.join(__dirname, 'mock-samples', 'sample1.png');
  if (!fs.existsSync(resolved)) {
    return res.status(500).json({ ok: false, error: 'Mock image not found' });
  }
  res.sendFile(resolved);
});

// Main try-on endpoint
app.post(
  '/api/generate',
  upload.fields([{ name: 'person' }, { name: 'cloth' }]),
  async (req, res) => {
    try {
      if (MODE === 'MOCK') {
        const resolved = path.join(__dirname, 'mock-samples', 'sample1.png');
        console.log('DEBUG: Serving mock image from', resolved);

        if (!fs.existsSync(resolved)) {
          return res
            .status(500)
            .json({ ok: false, error: 'Mock image not found' });
        }

        const stat = fs.statSync(resolved);
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': stat.size,
        });
        fs.createReadStream(resolved).pipe(res);
        return;
      }

      // Real model mode
      if (!MODEL_URL) {
        return res
          .status(500)
          .json({ ok: false, error: 'MODEL_URL not configured' });
      }
      if (!req.files || !req.files.person || !req.files.cloth) {
        return res
          .status(400)
          .json({ ok: false, error: 'person and cloth files required' });
      }

      const form = new FormData();
      form.append(
        'person',
        fs.createReadStream(req.files.person[0].path),
        req.files.person[0].originalname
      );
      form.append(
        'cloth',
        fs.createReadStream(req.files.cloth[0].path),
        req.files.cloth[0].originalname
      );

      const resp = await axios.post(MODEL_URL, form, {
        headers: { ...form.getHeaders() },
        responseType: 'arraybuffer',
        timeout: 5 * 60 * 1000,
        maxContentLength: 200 * 1024 * 1024,
      });

      res.setHeader(
        'Content-Type',
        resp.headers['content-type'] || 'image/png'
      );
      res.send(Buffer.from(resp.data));
    } catch (err) {
      console.error('ERROR:', err && (err.stack || err.message || err));
      res.status(500).json({
        ok: false,
        error:
          err.response && err.response.data
            ? err.response.data
            : err.message || 'server error',
      });
    } finally {
      try {
        if (req && req.files)
          Object.values(req.files)
            .flat()
            .forEach((f) => fs.unlinkSync(f.path));
      } catch (e) {}
    }
  }
);

app.listen(PORT, () => {
  console.log('Listening on', PORT, 'MODE=', MODE);
});


