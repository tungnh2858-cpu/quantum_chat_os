const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireTool } = require('../middleware/permissions');

const router = express.Router();
const PISTON_API_URL = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

// Node 18+ has global fetch
async function pistonFetch(pathname, options) {
  const resp = await fetch(`${PISTON_API_URL}${pathname}`, options);
  if (!resp.ok) throw new Error(`Piston API error: ${resp.status}`);
  return resp.json();
}

// GET /api/ide/languages  -> list of supported languages/versions
router.get('/languages', requireAuth, requireTool('ide'), async (req, res) => {
  try {
    const runtimes = await pistonFetch('/runtimes');
    res.json({ runtimes });
  } catch (e) {
    // Fallback static list if the public API is unreachable (offline dev, firewalled network...)
    res.json({
      runtimes: [
        { language: 'javascript', version: '18.15.0' },
        { language: 'python', version: '3.10.0' },
        { language: 'java', version: '15.0.2' },
        { language: 'c', version: '10.2.0' },
        { language: 'c++', version: '10.2.0' },
        { language: 'csharp', version: '6.12.0' },
        { language: 'go', version: '1.16.2' },
        { language: 'php', version: '8.2.3' },
        { language: 'ruby', version: '3.0.1' },
        { language: 'rust', version: '1.68.2' },
        { language: 'typescript', version: '5.0.3' },
        { language: 'kotlin', version: '1.8.20' },
        { language: 'swift', version: '5.3.3' },
        { language: 'dart', version: '2.19.6' },
        { language: 'bash', version: '5.2.0' }
      ],
      fallback: true
    });
  }
});

// POST /api/ide/execute  { language, version, code, stdin }
router.post('/execute', requireAuth, requireTool('ide'), async (req, res) => {
  const { language, version, code, stdin, files } = req.body || {};
  if (!language || !code) return res.status(400).json({ error: 'Thiếu ngôn ngữ hoặc mã nguồn.' });
  try {
    const result = await pistonFetch('/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version: version || '*',
        files: files || [{ name: 'main', content: code }],
        stdin: stdin || ''
      })
    });
    res.json({ result });
  } catch (e) {
    res.status(502).json({ error: 'Không thể kết nối tới dịch vụ chạy mã (Piston API). Kiểm tra kết nối mạng.', detail: e.message });
  }
});

module.exports = router;
