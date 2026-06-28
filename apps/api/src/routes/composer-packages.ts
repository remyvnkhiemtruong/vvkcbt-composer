import { Router, Request, Response } from 'express';
import {
  buildTemplateZip,
  buildSubjectZipFilename,
  exportFromState,
  exportSubjectFromState,
  exportAllSubjectsFromState,
  validateExportState,
} from '@vnu/exam-package-kit';
import type { ExamPackageExportState } from '@vnu/shared-types';
import { requireComposerAuth } from '../auth';

export const composerPackagesRouter = Router();

composerPackagesRouter.use(requireComposerAuth);

function parseExportState(body: unknown): ExamPackageExportState | null {
  if (!body || typeof body !== 'object') return null;
  const state = body as ExamPackageExportState;
  if (!state.manifest || !state.session) return null;
  return state;
}

composerPackagesRouter.get('/template', async (_req: Request, res: Response) => {
  try {
    const buffer = await buildTemplateZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="exam-package-mau.zip"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Template failed' });
  }
});

composerPackagesRouter.post('/validate', (req: Request, res: Response) => {
  const state = parseExportState(req.body);
  if (!state) {
    res.status(400).json({ message: 'Body không hợp lệ: thiếu manifest hoặc session' });
    return;
  }
  const body = req.body as ExportBySubjectBody;
  const { subjectCode } = body;
  res.json(validateExportState(state, subjectCode ? { subjectCode } : undefined));
});

composerPackagesRouter.post('/export', async (req: Request, res: Response) => {
  const state = parseExportState(req.body);
  if (!state) {
    res.status(400).json({ message: 'Body không hợp lệ: thiếu manifest hoặc session' });
    return;
  }
  const validation = validateExportState(state);
  if (!validation.valid) {
    res.status(400).json({ message: validation.errors.join('; '), ...validation });
    return;
  }
  try {
    const buffer = await exportFromState(state);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="exam-package.zip"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Export failed' });
  }
});

type ExportBySubjectBody = ExamPackageExportState & { subjectCode?: string };

composerPackagesRouter.post('/export-by-subject', async (req: Request, res: Response) => {
  const parsed = parseExportState(req.body);
  if (!parsed) {
    res.status(400).json({ message: 'Body không hợp lệ: thiếu manifest hoặc session' });
    return;
  }
  const { subjectCode, ...rest } = req.body as ExportBySubjectBody;
  const state = { ...rest, manifest: parsed.manifest, session: parsed.session } as ExamPackageExportState;

  try {
    if (subjectCode) {
      const validation = validateExportState(state, { subjectCode });
      if (!validation.valid) {
        res.status(400).json({ message: validation.errors.join('; '), ...validation });
        return;
      }
      const buffer = await exportSubjectFromState(state, subjectCode);
      const filename = buildSubjectZipFilename(state, subjectCode);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }

    const files = await exportAllSubjectsFromState(state);
    if (!files.length) {
      res.status(400).json({ message: 'Không có môn nào đủ điều kiện xuất (đề + thí sinh)' });
      return;
    }
    res.json({
      packageId: state.manifest.packageId,
      files: files.map((f) => ({
        subjectCode: f.subjectCode,
        filename: f.filename,
        data: f.buffer.toString('base64'),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : 'Export by subject failed' });
  }
});
