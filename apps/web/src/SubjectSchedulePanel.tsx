import { TN_THPT_SUBJECTS } from '@vnu/shared-types';
import type { ExamPackageExportState, ExamPackageSubjectRow } from '@vnu/shared-types';

function calcEndTime(startTime: string, durationMin: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total = (h || 0) * 60 + (m || 0) + durationMin;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

export function SubjectSchedulePanel({
  draft,
  onChange,
  activeSubject,
  singleSubjectMode,
}: {
  draft: ExamPackageExportState;
  onChange: (fn: (d: ExamPackageExportState) => void) => void;
  activeSubject?: string;
  singleSubjectMode?: boolean;
}) {
  const updateRow = (code: string, patch: Partial<ExamPackageSubjectRow>) => {
    onChange((d) => {
      const idx = d.subjects.findIndex((s) => s.code === code);
      if (idx < 0) return;
      const row = { ...d.subjects[idx], ...patch };
      if (patch.startTime || patch.durationMin) {
        row.endTime = calcEndTime(row.startTime, row.durationMin);
      }
      d.subjects[idx] = row;
    });
  };

  const toggleSubject = (code: string, on: boolean) => {
    onChange((d) => {
      const meta = TN_THPT_SUBJECTS.find((s) => s.code === code)!;
      if (on && !d.subjects.find((s) => s.code === code)) {
        const idx = d.subjects.length;
        d.subjects.push({
          code,
          nameVi: meta.nameVi,
          examDate: new Date().toISOString().slice(0, 10),
          startTime: `${String(7 + idx).padStart(2, '0')}:30`,
          endTime: calcEndTime(`${String(7 + idx).padStart(2, '0')}:30`, meta.durationMin),
          durationMin: meta.durationMin,
          structureMode: 'default',
          ui_mode: meta.uiMode,
        });
      } else if (!on) {
        d.subjects = d.subjects.filter((s) => s.code !== code);
      }
    });
  };

  const rows = singleSubjectMode && activeSubject
    ? draft.subjects.filter((s) => s.code === activeSubject)
    : draft.subjects;

  const period = draft.session.rules.assessment_period;
  const isGkCk = period?.startsWith('GK') || period?.startsWith('CK');

  return (
    <div className="composer-panel">
      <p className="admin-hint">
        Lịch mở đề — giám thị bấm <strong>Mở đề</strong> đúng giờ (release_mode: proctor_at_time).
      </p>
      {isGkCk && activeSubject && (
        <p className="admin-hint" style={{ color: '#0369a1' }}>
          TT22: môn ≤70 tiết/năm thường 45′; &gt;70 tiết 60–90′; chuyên tối đa 120′. Thời lượng mặc định QD764 — chỉnh{' '}
          <strong>Phút</strong> nếu cần khớp kỳ GK/CK.
        </p>
      )}
      {!singleSubjectMode && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {TN_THPT_SUBJECTS.map((s) => {
            const activeCodes = new Set(draft.subjects.map((x) => x.code));
            return (
              <label key={s.code} style={{ fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={activeCodes.has(s.code)}
                  onChange={(e) => toggleSubject(s.code, e.target.checked)}
                />{' '}
                {s.nameVi}
              </label>
            );
          })}
        </div>
      )}
      {singleSubjectMode && !activeSubject && (
        <p className="admin-hint" style={{ color: '#b45309' }}>Chọn môn đang setup ở banner phía trên.</p>
      )}
      {rows.length > 0 && (
        <table className="cbt-table">
          <thead>
            <tr>
              <th>Môn</th>
              <th>Ngày</th>
              <th>Giờ mở</th>
              <th>Giờ kết thúc</th>
              <th>Phút</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code}>
                <td>{row.nameVi}</td>
                <td>
                  <input
                    className="cbt-input"
                    type="date"
                    value={row.examDate}
                    onChange={(e) => updateRow(row.code, { examDate: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="cbt-input"
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateRow(row.code, { startTime: e.target.value })}
                  />
                </td>
                <td>
                  <input className="cbt-input" type="time" value={row.endTime} readOnly />
                </td>
                <td>
                  <input
                    className="cbt-input"
                    type="number"
                    value={row.durationMin}
                    onChange={(e) => updateRow(row.code, { durationMin: Number(e.target.value) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
