

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleStreamDomains, handleStreamGenerator } from './lib/streamController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// SSE Domain Search & Generation Streaming Endpoints
app.get('/api/stream-domains', handleStreamDomains);
app.get('/api/stream-generator', handleStreamGenerator);
app.post('/api/stream-generator', handleStreamGenerator);

// Dedicated page routes
app.get('/generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'generator.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Gasim NUME pentru BNS server running at http://localhost:${PORT}`);
  console.log(`Search page:    http://localhost:${PORT}/search`);
  console.log(`Generator page: http://localhost:${PORT}/generator`);
});

