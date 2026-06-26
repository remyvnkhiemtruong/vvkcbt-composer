import { FormEvent, useEffect, useState } from 'react';
import { CbtPageShell, CbtBrandLogo } from '@vnu/web-shared';
import { TN_THPT_SUBJECTS, validateSubjectBlueprint } from '@vnu/shared-types';
import type { ExamPackageExportState } from '@vnu/shared-types';
import {
  clearComposerToken,
  composerLogin,
  getComposerToken,
} from './api';
import {
  addQuestion,
  createEmptyDraft,
  loadDraft,
  saveDraft,
  loadComposerUi,
  saveComposerUi,
  credentialsReady,
  registerBrandingLogo,
  getComposerProgress,
  type ComposerUiState,
} from './draft';
import { SubjectSetupBanner } from './SubjectSetupBanner';
import { SingleSubjectExportPanel } from './SingleSubjectExportPanel';
import { ComposerSubjectRouter } from './ComposerSubjectRouter';
import { PaperBuilder } from './PaperBuilder';
import { CredentialsPanel } from './CredentialsPanel';
import { SubjectSchedulePanel } from './SubjectSchedulePanel';
import { ComposerWizard } from './ComposerWizard';
import { ComposerToast } from './ComposerToast';
import { StudentRosterPanel } from './StudentRosterPanel';

type Tab = 'config' | 'schedule' | 'questions' | 'papers' | 'students' | 'credentials' | 'export';
type UiMode = 'tabs' | 'wizard';

const UI_MODE_KEY = 'composer_ui_mode';

function ComposerLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('composer');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await composerLogin(username, password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    }
  };

  return (
    <CbtPageShell headerTitle="VVKCBT - Composer">
      <form className="composer-login" onSubmit={submit}>
        <h2>Đăng nhập soạn gói thi</h2>
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
        <input className="cbt-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tài khoản" />
        <input className="cbt-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" />
        <button type="submit" className="cbt-btn cbt-btn-primary">Đăng nhập</button>
        <p className="admin-hint">Mặc định: composer / composer123</p>
      </form>
    </CbtPageShell>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  config: 'Cấu hình ca',
  schedule: 'Lịch thi & mở đề',
  questions: 'Soạn câu hỏi',
  papers: 'Ghép đề',
  students: 'Thí sinh',
  credentials: 'SBD & phiếu',
  export: 'Xuất ZIP',
};

export default function App() {
  const [authed, setAuthed] = useState(() => !!getComposerToken());
  const [tab, setTab] = useState<Tab>('config');
  const [uiMode, setUiMode] = useState<UiMode>(() => {
    try {
      return (localStorage.getItem(UI_MODE_KEY) as UiMode) || 'wizard';
    } catch {
      return 'wizard';
    }
  });
  const [draft, setDraft] = useState<ExamPackageExportState>(() => loadDraft());
  const [composerUi, setComposerUi] = useState<ComposerUiState>(() => loadComposerUi());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const activeSubject = composerUi.activeSubject;
  const progress = getComposerProgress(draft, activeSubject);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    saveComposerUi(composerUi);
  }, [composerUi]);

  useEffect(() => {
    localStorage.setItem(UI_MODE_KEY, uiMode);
  }, [uiMode]);

  const patch = (fn: (d: ExamPackageExportState) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const patchUi = (fn: (u: ComposerUiState) => void) => {
    setComposerUi((prev) => {
      const next = {
        ...prev,
        sealedExports: { ...prev.sealedExports },
        printedSubjects: { ...prev.printedSubjects },
      };
      fn(next);
      return next;
    });
  };

  const addQ = (q: Parameters<typeof addQuestion>[1]) => {
    patch((d) => addQuestion(d, q));
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
  };

  if (!authed) {
    return <ComposerLogin onLogin={() => setAuthed(true)} />;
  }

  return (
    <CbtPageShell
      headerTitle="VVKCBT - Composer"
      headerLeft={<CbtBrandLogo size={40} logoUrl="/branding/logo.png" />}
      headerRight={draft.manifest.examName}
    >
      <div className="composer-mode-toggle">
        <button
          type="button"
          className={`cbt-btn ${uiMode === 'wizard' ? 'cbt-btn-primary' : 'cbt-btn-outline'}`}
          onClick={() => setUiMode('wizard')}
        >
          Hướng dẫn từng bước
        </button>
        <button
          type="button"
          className={`cbt-btn ${uiMode === 'tabs' ? 'cbt-btn-primary' : 'cbt-btn-outline'}`}
          onClick={() => setUiMode('tabs')}
        >
          Chế độ đầy đủ (7 tab)
        </button>
        <button type="button" className="cbt-btn cbt-btn-outline" style={{ marginLeft: 'auto' }} onClick={() => { clearComposerToken(); setAuthed(false); }}>
          Đăng xuất
        </button>
      </div>

      {uiMode === 'wizard' ? (
        <ComposerWizard
          draft={draft}
          onChange={patch}
          onAddQuestion={addQ}
          onReset={() => {
            setDraft(createEmptyDraft());
            setComposerUi({ sealedExports: {}, printedSubjects: {} });
          }}
          ui={composerUi}
          onUiChange={patchUi}
        />
      ) : (
        <>
          <SubjectSetupBanner
            draft={draft}
            ui={composerUi}
            onUiChange={patchUi}
            onDraftChange={patch}
          />
          <div className="composer-tabs">
            {(['config', 'schedule', 'questions', 'papers', 'students', 'credentials', 'export'] as Tab[]).map((t) => (
              <button key={t} type="button" className={`cbt-btn ${tab === t ? 'cbt-btn-primary' : 'cbt-btn-outline'}`} onClick={() => setTab(t)}>
                {TAB_LABELS[t]}
                {t === 'questions' && progress.enabledCount > 0 && (
                  <span className="composer-tab-badge">{progress.subjects.filter((s) => s.bankCount > 0).length}/{progress.enabledCount}</span>
                )}
                {t === 'papers' && progress.enabledCount > 0 && (
                  <span className="composer-tab-badge">{progress.blueprintOkCount}/{progress.enabledCount}</span>
                )}
              </button>
            ))}
            <button type="button" className="cbt-btn cbt-btn-outline" style={{ marginLeft: 'auto' }} onClick={() => { clearComposerToken(); setAuthed(false); }}>
              Đăng xuất
            </button>
          </div>

          <div className="composer-next-banner">
            <strong>Bước tiếp theo:</strong> {progress.nextStepHint}
            <button type="button" className="cbt-btn cbt-btn-outline composer-next-btn" onClick={() => setTab(progress.nextTab)}>
              Đi tới
            </button>
          </div>

          {tab === 'config' && (
            <div className="composer-panel">
              <div className="composer-row">
                <label>Tên kỳ thi</label>
                <input
                  className="cbt-input"
                  value={draft.session.name}
                  onChange={(e) =>
                    patch((d) => {
                      d.session.name = e.target.value;
                      d.manifest.examName = e.target.value;
                    })
                  }
                />
              </div>
              <div className="composer-row">
                <label>Loại kỳ</label>
                <select
                  className="cbt-input"
                  value={draft.session.rules.assessment_period ?? 'GK2'}
                  onChange={(e) =>
                    patch((d) => {
                      const period = e.target.value as 'GK1' | 'GK2' | 'CK1' | 'CK2';
                      d.session.rules.assessment_period = period;
                      d.session.rules.exam_type = 'GDPT_2018';
                    })
                  }
                >
                  <option value="GK1">Giữa kỳ 1</option>
                  <option value="GK2">Giữa kỳ 2</option>
                  <option value="CK1">Cuối kỳ 1</option>
                  <option value="CK2">Cuối kỳ 2 / Mock TN</option>
                </select>
              </div>
              <div className="composer-row">
                <label>Sở GDĐT</label>
                <input
                  className="cbt-input"
                  value={draft.manifest.branding?.soGdName ?? ''}
                  placeholder="SỞ GDĐT CÀ MAU"
                  onChange={(e) =>
                    patch((d) => {
                      if (!d.manifest.branding) d.manifest.branding = {};
                      d.manifest.branding.soGdName = e.target.value;
                    })
                  }
                />
              </div>
              <div className="composer-row">
                <label>Tên trường</label>
                <input
                  className="cbt-input"
                  value={draft.manifest.branding?.schoolName ?? ''}
                  placeholder="TRƯỜNG THPT VÕ VĂN KIỆT"
                  onChange={(e) =>
                    patch((d) => {
                      if (!d.manifest.branding) d.manifest.branding = {};
                      d.manifest.branding.schoolName = e.target.value;
                    })
                  }
                />
              </div>
              <div className="composer-row">
                <label>Logo trường (ZIP branding)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const next = structuredClone(draft);
                    await registerBrandingLogo(next, file);
                    setDraft(next);
                    showToast('Đã cập nhật logo', 'success');
                    e.target.value = '';
                  }}
                />
              </div>
              <div className="composer-row">
                <label>Vi phạm focus tối đa</label>
                <input
                  className="cbt-input"
                  type="number"
                  value={draft.session.rules.proctoring.max_focus_violations}
                  onChange={(e) =>
                    patch((d) => {
                      d.session.rules.proctoring.max_focus_violations = Number(e.target.value);
                    })
                  }
                />
                <label>Autosave (giây, fallback)</label>
                <input
                  className="cbt-input"
                  type="number"
                  value={draft.session.rules.proctoring.autosave_interval_sec}
                  onChange={(e) =>
                    patch((d) => {
                      d.session.rules.proctoring.autosave_interval_sec = Number(e.target.value);
                    })
                  }
                />
              </div>
              <div className="composer-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                {(
                  [
                    ['require_fullscreen', 'Bắt buộc fullscreen'],
                    ['block_copy_paste', 'Chặn copy/dán'],
                    ['block_context_menu', 'Chặn menu chuột phải'],
                    ['watermark', 'Watermark SBD/tài khoản'],
                    ['single_active_session', '1 phiên / tài khoản'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} style={{ fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={draft.session.rules.proctoring[key] !== false}
                      onChange={(e) =>
                        patch((d) => {
                          (d.session.rules.proctoring as Record<string, boolean>)[key] = e.target.checked;
                        })
                      }
                    />{' '}
                    {label}
                  </label>
                ))}
              </div>
              <p className="admin-hint" style={{ marginTop: '1rem' }}>
                Đề máy theo QĐ764 — quy đổi điểm GK theo quy chế trường.
              </p>
              <div style={{ marginTop: '1.5rem' }}>
                <h4>Blueprint — trạng thái 11 môn</h4>
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th align="left">Môn</th>
                      <th align="left">Câu</th>
                      <th align="left">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TN_THPT_SUBJECTS.map((s) => {
                      const paper = draft.papers[s.code];
                      const bp = paper?.questions?.length
                        ? validateSubjectBlueprint({
                            subjectCode: s.code,
                            paper,
                            clusters: draft.clusters,
                            mediaManifest: draft.manifest.mediaManifest,
                          })
                        : { valid: false, errors: ['Chưa có đề'] };
                      return (
                        <tr key={s.code}>
                          <td>{s.nameVi}</td>
                          <td>{paper?.questions?.length ?? 0}</td>
                          <td style={{ color: bp.valid ? '#15803d' : '#b91c1c' }}>
                            {bp.valid ? 'Sẵn sàng' : bp.errors.join(' · ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'schedule' && (
            <SubjectSchedulePanel
              draft={draft}
              onChange={patch}
              activeSubject={activeSubject}
              singleSubjectMode
            />
          )}

          {tab === 'questions' && (
            <div className="composer-panel">
              <ComposerSubjectRouter
                draft={draft}
                onDraftChange={patch}
                onAdd={addQ}
                lockSubject={activeSubject}
              />
            </div>
          )}

          {tab === 'papers' && <PaperBuilder draft={draft} onChange={patch} lockSubject={activeSubject} />}

          {tab === 'students' && (
            <StudentRosterPanel
              draft={draft}
              onChange={patch}
              onToast={showToast}
              activeSubject={activeSubject}
              onUiChange={(fn) => patchUi((u) => fn(u))}
            />
          )}

          {tab === 'credentials' && (
            <CredentialsPanel
              draft={draft}
              onChange={patch}
              onToast={showToast}
              activeSubject={activeSubject}
              onUiChange={patchUi}
              printedSubjects={composerUi.printedSubjects}
            />
          )}

          {tab === 'export' && (
            <SingleSubjectExportPanel
              draft={draft}
              activeSubject={activeSubject}
              ui={composerUi}
              onUiChange={patchUi}
              onDraftChange={patch}
              onToast={showToast}
              onSetupNextSubject={() => {
                patchUi((u) => {
                  u.activeSubject = undefined;
                });
                setTab('schedule');
                showToast('Chọn môn tiếp theo', 'info');
              }}
            />
          )}
        </>
      )}

      {toast && <ComposerToast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </CbtPageShell>
  );
}
