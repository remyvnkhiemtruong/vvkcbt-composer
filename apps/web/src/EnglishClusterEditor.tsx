import { useMemo, useState } from 'react';
import { RichTextContent } from '@vnu/web-shared';
import type { ExamPackageClusterRow, ExamPackageExportState, ExamPackageQuestionRow } from '@vnu/shared-types';
import { getDefaultStructure } from '@vnu/shared-types';
import { getClusterSubtypeVi } from './composer-labels';
import { ComposerToast } from './ComposerToast';
import { ENGLISH_CLUSTER_ORDER, getClusterProgress, updateQuestion } from './draft';

const SUBTYPE_HINTS: Record<string, string> = {
  fill_notice: 'Notice / advertisement — điền từ vào chỗ trống',
  fill_flyer: 'Flyer / poster — điền từ vào tờ rơi',
  reorder: 'Sắp xếp câu thành đoạn hội thoại / thư',
  fill_gap: 'Gap-fill trong đoạn văn liền mạch',
  reading_8: '1 passage — 8 câu đọc hiểu',
  reading_10: '1 passage — 10 câu đọc hiểu',
};

export function EnglishClusterEditor({
  draft,
  onChange,
}: {
  draft: ExamPackageExportState;
  onChange: (fn: (d: ExamPackageExportState) => void) => void;
}) {
  const layout = getDefaultStructure('ENGLISH')?.clusterLayout;
  const progress = getClusterProgress(draft);
  const [activeSubtype, setActiveSubtype] = useState<string>('fill_notice');
  const [passageDraft, setPassageDraft] = useState('');
  const [editQId, setEditQId] = useState<string | null>(null);
  const [stem, setStem] = useState('');
  const [options, setOptions] = useState(['A. ', 'B. ', 'C. ', 'D. ']);
  const [correctKey, setCorrectKey] = useState('A');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const cluster = (draft.clusters ?? []).find((c) => c.clusterSubtype === activeSubtype);
  const clusterQs = useMemo(() => {
    const qs = (draft.papers.ENGLISH?.questions ?? []) as ExamPackageQuestionRow[];
    return qs
      .filter((q) => (q as { clusterSubtype?: string }).clusterSubtype === activeSubtype)
      .sort((a, b) => (a.clusterOrder ?? 0) - (b.clusterOrder ?? 0));
  }, [draft, activeSubtype]);

  const passageText = String((cluster?.passage as { text?: string })?.text ?? passageDraft);

  const showToast = (msg: string, t: 'success' | 'error' | 'info' = 'info') => setToast({ msg, type: t });

  const createCluster = () => {
    if (!passageDraft.trim()) {
      showToast('Nhập passage trước khi tạo cluster', 'error');
      return;
    }
    const item = layout?.clusters.find((c) => c.subtype === activeSubtype);
    if (!item) return;

    if (cluster) {
      const ok = window.confirm(`Thay thế cluster "${getClusterSubtypeVi(activeSubtype, item.count)}"?`);
      if (!ok) return;
    }

    const clusterId = `cl-${activeSubtype}-${crypto.randomUUID().slice(0, 6)}`;
    const questionIds: string[] = [];

    onChange((d) => {
      const enPaper = d.papers.ENGLISH ?? { title: 'Anh', subject: 'ENGLISH', questions: [], difficultyMeta: {} };
      enPaper.questions = enPaper.questions.filter(
        (q) => (q as { clusterSubtype?: string }).clusterSubtype !== activeSubtype,
      );
      for (let i = 0; i < item.count; i++) {
        const qid = crypto.randomUUID();
        questionIds.push(qid);
        enPaper.questions.push({
          id: qid,
          subject: 'ENGLISH',
          type: 'cluster_mcq',
          part: 'part1_cluster_mcq',
          clusterId,
          clusterOrder: i + 1,
          clusterSubtype: activeSubtype,
          difficulty: 'medium',
          content: { stem: '', options: ['A. ', 'B. ', 'C. ', 'D. '] },
          correctKey: 'A',
          maxScore: 0.25,
        });
      }
      d.papers.ENGLISH = enPaper;
      const row: ExamPackageClusterRow = {
        id: clusterId,
        subject: 'ENGLISH',
        clusterSubtype: activeSubtype,
        passage: { text: passageDraft },
        questionIds,
      };
      d.clusters = [...(d.clusters ?? []).filter((c) => c.clusterSubtype !== activeSubtype), row];
    });
    setPassageDraft('');
    showToast(`Đã tạo ${getClusterSubtypeVi(activeSubtype, item.count)}`, 'success');
  };

  const updatePassage = () => {
    if (!cluster) return;
    onChange((d) => {
      const c = (d.clusters ?? []).find((x) => x.id === cluster.id);
      if (c) c.passage = { text: passageDraft || passageText };
    });
    showToast('Đã cập nhật passage', 'success');
  };

  const deleteCluster = (clusterId: string, subtype: string) => {
    if (!window.confirm(`Xóa cluster "${getClusterSubtypeVi(subtype)}"?`)) return;
    onChange((d) => {
      d.clusters = (d.clusters ?? []).filter((c) => c.id !== clusterId);
      const paper = d.papers.ENGLISH;
      if (paper) {
        paper.questions = paper.questions.filter((q) => (q as { clusterId?: string }).clusterId !== clusterId);
      }
    });
    if (activeSubtype === subtype) setEditQId(null);
    showToast('Đã xóa cluster', 'info');
  };

  const loadQuestion = (q: ExamPackageQuestionRow) => {
    setEditQId(q.id);
    setStem(String(q.content?.stem ?? ''));
    if (q.content?.options) setOptions(q.content.options as string[]);
    setCorrectKey(String(q.correctKey ?? 'A'));
  };

  const saveQuestion = () => {
    if (!editQId) return;
    const existing = clusterQs.find((q) => q.id === editQId);
    if (!existing) return;

    const updated: ExamPackageQuestionRow = {
      ...existing,
      content: { stem, options },
      correctKey,
      clusterId: existing.clusterId,
      clusterSubtype: (existing as { clusterSubtype?: string }).clusterSubtype,
      clusterOrder: existing.clusterOrder,
    };

    onChange((d) => updateQuestion(d, updated));
    showToast('Đã lưu câu', 'success');
    setEditQId(null);
    setStem('');
  };

  const selectSubtype = (subtype: string) => {
    setActiveSubtype(subtype);
    setEditQId(null);
    setStem('');
    const c = (draft.clusters ?? []).find((x) => x.clusterSubtype === subtype);
    setPassageDraft(String((c?.passage as { text?: string })?.text ?? ''));
  };

  const doneCount = progress.filter((p) => p.ok).length;

  return (
    <div className="composer-english-layout">
      <p className="admin-hint">
        Tiếng Anh — 40 câu MCQ chùm / 6 dạng QĐ764. Tiến độ: {doneCount}/6 cluster.
        Không dùng Nhập Word — soạn từng cluster.
      </p>

      <div className="composer-cluster-cards">
        {ENGLISH_CLUSTER_ORDER.map((subtype) => {
          const p = progress.find((x) => x.subtype === subtype);
          const count = layout?.clusters.find((c) => c.subtype === subtype)?.count ?? 0;
          return (
            <button
              key={subtype}
              type="button"
              className={`composer-cluster-card ${activeSubtype === subtype ? 'active' : ''} ${p?.ok ? 'ok' : ''}`}
              onClick={() => selectSubtype(subtype)}
            >
              <span className="composer-cluster-card-title">{getClusterSubtypeVi(subtype, count)}</span>
              <span className="composer-cluster-card-status">
                {p?.ok ? '✓' : `${p?.actual ?? 0}/${count}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="composer-english-workspace">
        <div className="composer-english-passage-col">
          <h4>{getClusterSubtypeVi(activeSubtype)}</h4>
          <p className="admin-hint">{SUBTYPE_HINTS[activeSubtype]}</p>
          <textarea
            className="cbt-textarea"
            rows={8}
            value={passageDraft || passageText}
            onChange={(e) => setPassageDraft(e.target.value)}
            placeholder="Passage / đoạn văn chung (bắt buộc)"
          />
          <div className="composer-row">
            {!cluster ? (
              <button type="button" className="cbt-btn cbt-btn-primary" onClick={createCluster}>Tạo cluster + câu trống</button>
            ) : (
              <>
                <button type="button" className="cbt-btn cbt-btn-outline" onClick={updatePassage}>Lưu passage</button>
                <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => deleteCluster(cluster.id, activeSubtype)}>Xóa cluster</button>
              </>
            )}
          </div>
          {passageText && (
            <div className="composer-passage-preview composer-split-preview">
              <strong>Preview passage</strong>
              <p>{passageText}</p>
            </div>
          )}
        </div>

        <div className="composer-english-questions-col">
          {!cluster ? (
            <p className="admin-hint">Nhập passage và bấm Tạo cluster để bắt đầu soạn câu.</p>
          ) : (
            <>
              <h4>Câu hỏi ({clusterQs.length})</h4>
              <ul className="composer-cluster-q-grid">
                {clusterQs.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className={`cbt-btn ${editQId === q.id ? 'cbt-btn-primary' : 'cbt-btn-outline'}`}
                      onClick={() => loadQuestion(q)}
                    >
                      Câu {q.clusterOrder}: {String((q.content as { stem?: string })?.stem ?? '').slice(0, 40) || '(trống)'}
                    </button>
                  </li>
                ))}
              </ul>

              {editQId && (
                <div className="composer-cluster-q-form">
                  <textarea className="cbt-textarea" rows={2} value={stem} onChange={(e) => setStem(e.target.value)} placeholder="Stem" />
                  {options.map((opt, i) => (
                    <input key={i} className="cbt-input" value={opt} onChange={(e) => {
                      const next = [...options]; next[i] = e.target.value; setOptions(next);
                    }} />
                  ))}
                  <select className="cbt-select" value={correctKey} onChange={(e) => setCorrectKey(e.target.value)}>
                    {['A', 'B', 'C', 'D'].map((k) => <option key={k} value={k}>{k} đúng</option>)}
                  </select>
                  <button type="button" className="cbt-btn cbt-btn-primary" onClick={saveQuestion}>Lưu câu</button>
                  <button type="button" className="cbt-btn cbt-btn-outline" onClick={() => setEditQId(null)}>Hủy</button>
                  {stem && <RichTextContent content={stem} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <ComposerToast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
