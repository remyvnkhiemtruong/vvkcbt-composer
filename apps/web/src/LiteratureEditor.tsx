import { useMemo, useState } from 'react';
import { RichTextContent } from '@vnu/web-shared';
import type { ExamPackageExportState, ExamPackageQuestionRow } from '@vnu/shared-types';
import { uploadMedia } from './api';
import { ComposerToast } from './ComposerToast';
import { listQuestions, mediaToken, updateQuestion } from './draft';
import { defaultMaxScore } from './questionFormUtils';

const PARTS = [
  { key: 'part1_reading', title: 'Đọc hiểu', score: 4, hint: 'Passage + đề bài đọc hiểu (4 điểm)' },
  { key: 'part2_writing', title: 'Viết', score: 6, hint: 'Đề bài viết — thể loại, độ dài gợi ý (6 điểm)' },
] as const;

export function LiteratureEditor({
  draft,
  onDraftChange,
  onAdd,
}: {
  draft: ExamPackageExportState;
  onDraftChange: (fn: (d: ExamPackageExportState) => void) => void;
  onAdd: (q: ExamPackageQuestionRow) => void;
}) {
  const bank = listQuestions(draft, 'LITERATURE');
  const readingQ = useMemo(() => bank.find((q) => q.part === 'part1_reading'), [bank]);
  const writingQ = useMemo(() => bank.find((q) => q.part === 'part2_writing'), [bank]);

  const [readingPassage, setReadingPassage] = useState(() => String(readingQ?.content?.passage ?? ''));
  const [readingStem, setReadingStem] = useState(() => String(readingQ?.content?.stem ?? ''));
  const [writingStem, setWritingStem] = useState(() => String(writingQ?.content?.stem ?? ''));
  const [writingHint, setWritingHint] = useState(() => String((writingQ?.content as { rubric?: string })?.rubric ?? ''));
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, t: 'success' | 'error' | 'info' = 'info') => setToast({ msg, type: t });

  const savePart = (partKey: string, stem: string, passage?: string, rubric?: string) => {
    const existing = bank.find((q) => q.part === partKey);
    const content: Record<string, unknown> = { stem };
    if (passage) content.passage = passage;
    if (rubric) content.rubric = rubric;

    const q: ExamPackageQuestionRow = {
      id: existing?.id ?? crypto.randomUUID(),
      subject: 'LITERATURE',
      type: 'essay',
      part: partKey,
      difficulty: 'medium',
      content,
      correctKey: null,
      maxScore: defaultMaxScore('LITERATURE', 'essay', partKey),
    } as ExamPackageQuestionRow & { part?: string };

    if (existing) {
      onDraftChange((d) => updateQuestion(d, q));
    } else {
      onAdd(q);
    }
    showToast('Đã lưu bài tự luận', 'success');
  };

  const uploadTo = async (file: File, kind: 'image' | 'audio', setter: (fn: (s: string) => string) => void) => {
    try {
      const { registerMediaFile } = await import('./draft');
      await uploadMedia(file);
      const next = structuredClone(draft);
      const zipPath = await registerMediaFile(next, file);
      onDraftChange((d) => {
        d.mediaFiles = next.mediaFiles;
        d.manifest.mediaManifest = next.manifest.mediaManifest;
      });
      setter((s) => `${s}\n${mediaToken(zipPath, kind)}`.trim());
    } catch {
      showToast('Upload thất bại', 'error');
    }
  };

  return (
    <div className="composer-essay-layout">
      <p className="admin-hint">Ngữ văn — 2 bài tự luận (Đọc hiểu 4đ + Viết 6đ). Giao diện song song giống thí sinh.</p>
      <div className="composer-essay-split">
        <section className="composer-essay-panel">
          <h4>Phần I — Đọc hiểu (4 điểm) {readingQ ? '✓' : '○'}</h4>
          <p className="admin-hint">{PARTS[0].hint}</p>
          <textarea className="cbt-textarea" rows={5} value={readingPassage} onChange={(e) => setReadingPassage(e.target.value)}
            placeholder="Đoạn văn / tác phẩm (passage)" />
          <textarea className="cbt-textarea" rows={4} value={readingStem} onChange={(e) => setReadingStem(e.target.value)}
            placeholder="Đề bài đọc hiểu" />
          <div className="composer-row">
            <label className="cbt-btn cbt-btn-outline" style={{ cursor: 'pointer' }}>
              Ảnh
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadTo(e.target.files[0], 'image', setReadingStem)} />
            </label>
            <button type="button" className="cbt-btn cbt-btn-primary"
              onClick={() => savePart('part1_reading', readingStem, readingPassage)}>
              Lưu Đọc hiểu
            </button>
          </div>
          {readingStem && (
            <div className="composer-essay-preview">
              {readingPassage && <p className="composer-passage-preview">{readingPassage.slice(0, 200)}…</p>}
              <RichTextContent content={readingStem} />
            </div>
          )}
        </section>

        <section className="composer-essay-panel">
          <h4>Phần II — Viết (6 điểm) {writingQ ? '✓' : '○'}</h4>
          <p className="admin-hint">{PARTS[1].hint}</p>
          <textarea className="cbt-textarea" rows={5} value={writingStem} onChange={(e) => setWritingStem(e.target.value)}
            placeholder="Đề bài viết" />
          <textarea className="cbt-textarea" rows={2} value={writingHint} onChange={(e) => setWritingHint(e.target.value)}
            placeholder="Gợi ý chấm / yêu cầu độ dài (tùy chọn)" />
          <button type="button" className="cbt-btn cbt-btn-primary"
            onClick={() => savePart('part2_writing', writingStem, undefined, writingHint)}>
            Lưu Viết
          </button>
          {writingStem && (
            <div className="composer-essay-preview">
              <RichTextContent content={writingStem} />
            </div>
          )}
        </section>
      </div>
      {toast && <ComposerToast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
