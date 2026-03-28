import { Router } from 'express';
import multer from 'multer';
import { parsePDF } from '../services/pdfParser.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file uploaded' });
      return;
    }

    const parsed = await parsePDF(req.file.buffer);
    res.json({
      filename: req.file.originalname,
      numPages: parsed.numPages,
      textLength: parsed.text.length,
      chunks: parsed.chunks,
      preview: parsed.text.slice(0, 500),
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

export { router as pdfRoutes };
