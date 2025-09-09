const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const cors = require('cors');

const upload = multer({ dest: '/tmp' });
const app = express();
app.use(cors({ origin: ['https://voguecraft-site-zkxp4c8m2-rohan-chenenis-projects.vercel.app','https://voguecraft.io','http://localhost:8000'] }));

const MODE = process.env.MODE || 'MOCK';
const MODEL_URL = process.env.MODEL_URL || '';
const MOCK_IMAGE_PATH = process.env.MOCK_IMAGE_PATH || './mock-samples/sample1.png';

app.post('/api/generate', upload.fields([{name:'person'},{name:'cloth'}]), async (req, res) => {
  try {
    if (MODE === 'MOCK') {
      const stat = fs.statSync(MOCK_IMAGE_PATH);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': stat.size
      });
      fs.createReadStream(MOCK_IMAGE_PATH).pipe(res);
      return;
    }

    const form = new FormData();
    form.append('person', fs.createReadStream(req.files.person[0].path), req.files.person[0].originalname);
    form.append('cloth', fs.createReadStream(req.files.cloth[0].path), req.files.cloth[0].originalname);

    const resp = await axios.post(MODEL_URL, form, {
      headers: { ...form.getHeaders() },
      responseType: 'arraybuffer',
      maxContentLength: 50 * 1024 * 1024
    });

    res.setHeader('Content-Type', resp.headers['content-type'] || 'image/png');
    res.send(Buffer.from(resp.data));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({ error: err.response ? err.response.data : err.message });
  } finally {
    try { if (req.files) Object.values(req.files).flat().forEach(f => fs.unlinkSync(f.path)); } catch(e){}
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Listening on', PORT, 'MODE=', MODE));
