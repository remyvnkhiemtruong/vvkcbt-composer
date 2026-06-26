import { config } from 'dotenv';
import { resolve } from 'path';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { authRouter } from './routes/auth';
import { composerPackagesRouter } from './routes/composer-packages';
import { coreRouter } from './routes/core';

config({ path: resolve(__dirname, '../../../.env') });

const app = express();
const port = Number(process.env.PORT || 3100);
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(uploadDir));
app.use('/api/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/composer/packages', composerPackagesRouter);
app.use('/api/core', coreRouter);

app.listen(port, () => {
  console.log(`Composer API listening on http://localhost:${port}`);
});
