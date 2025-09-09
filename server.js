const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const FormData = require("form-data");
const axios = require("axios");

const app = express();
const upload = multer({ dest: "uploads/" });
const PORT = process.env.PORT || 8080;

const MODE = process.env.MODE || "MOCK";
const MOCK_IMAGE_PATH = process.env.MOCK_IMAGE_PATH || "mock-samples/sample1.png";
const MODEL_URL = process.env.MODEL_URL || null;

// ✅ Enable CORS for frontend
app.use(cors({
  origin: "*", // allow all (later restrict to your domain)
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// --- Health check ---
app.get("/healthz", (req, res) => {
  res.json({ ok: true, mode: MODE });
});

// --- Simple mock image endpoint ---
app.get("/mock-image", (req, res) => {
  const resolved = path.resolve(process.cwd(), MOCK_IMAGE_PATH);
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: "Mock image not found" });
  }
  res.sendFile(resolved);
});

// --- Main try-on API ---
app.post("/api/generate", upload.fields([{ name: "person" }, { name: "cloth" }]), async (req, res) => {
  try {
    if (MODE === "MOCK") {
      const resolved = path.resolve(process.cwd(), MOCK_IMAGE_PATH);
      if (!fs.existsSync(resolved)) {
        return res.status(500).json({ error: "Mock image not found" });
      }
      const stat = fs.statSync(resolved);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": stat.size
      });
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    if (!MODEL_URL) {
      return res.status(500).json({ error: "MODEL_URL not configured" });
    }
    if (!req.files || !req.files.person || !req.files.cloth) {
      return res.status(400).json({ error: "person and cloth files required" });
    }

    const form = new FormData();
    form.append("person", fs.createReadStream(req.files.person[0].path));
    form.append("cloth", fs.createReadStream(req.files.cloth[0].path));

    const resp = await axios.post(MODEL_URL, form, {
      headers: form.getHeaders(),
      responseType: "arraybuffer",
      timeout: 5 * 60 * 1000,
    });

    res.setHeader("Content-Type", resp.headers["content-type"] || "image/png");
    res.send(Buffer.from(resp.data));
  } catch (err) {
    console.error("Error in /api/generate:", err.message);
    res.status(500).json({ error: err.message || "Server error" });
  } finally {
    try {
      if (req && req.files) {
        Object.values(req.files).flat().forEach(f => fs.unlinkSync(f.path));
      }
    } catch (e) {}
  }
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`✅ Listening on ${PORT} MODE=${MODE}`);
});







