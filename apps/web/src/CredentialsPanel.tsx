import { useState } from 'react';

import { TN_THPT_SUBJECTS } from '@vnu/shared-types';

import type { ExamPackageExportState } from '@vnu/shared-types';

import { assignCredentials, syncCredentialsPrintedAt, type ComposerUiState } from './draft';

import { printCredentialSlips } from './printCredentialSlips';

import type { ToastType } from './ComposerToast';



const SO_GD = import.meta.env.VITE_SO_GD_NAME || 'SỞ GDĐT CÀ MAU';

const SCHOOL = import.meta.env.VITE_SCHOOL_NAME || 'TRƯỜNG THPT VÕ VĂN KIỆT';



const SUBJECT_VI = Object.fromEntries(TN_THPT_SUBJECTS.map((s) => [s.code, s.nameVi]));



export function CredentialsPanel({

  draft,

  onChange,

  onToast,

  activeSubject,

  onUiChange,

  printedSubjects = {},

}: {

  draft: ExamPackageExportState;

  onChange: (fn: (d: ExamPackageExportState) => void) => void;

  onToast?: (msg: string, type?: ToastType) => void;

  activeSubject?: string;

  onUiChange?: (fn: (u: ComposerUiState) => void) => void;

  printedSubjects?: Record<string, string>;

}) {

  const creds = (draft.credentials ?? []).filter(
    (c) => !activeSubject || c.subjectCode === activeSubject,
  );

  const [filterSubject, setFilterSubject] = useState(activeSubject ?? '');



  const toast = (msg: string, type: ToastType = 'info') => {

    if (onToast) onToast(msg, type);

    else window.alert(msg);

  };



  const print6up = (subjectCode?: string) => {

    const rows = creds.filter((c) => !subjectCode || c.subjectCode === subjectCode);

    if (!rows.length) {

      toast('Chưa có credential — bấm "Xếp SBD & gán tài khoản" trước', 'error');

      return;

    }

    printCredentialSlips(

      rows.map((c) => ({

        sbd: c.sbd,

        pin: c.pin,

        fullName: c.fullName,

        className: c.className,

        examAccount: c.examAccount,

        subjectCode: c.subjectCode,

        subjectName: SUBJECT_VI[c.subjectCode] ?? c.subjectCode,

        dateOfBirth: c.dateOfBirth,

        gender: c.gender,

      })),

      {

        sessionName: draft.session.name,

        soGdName: draft.manifest.branding?.soGdName ?? SO_GD,

        schoolName: draft.manifest.branding?.schoolName ?? SCHOOL,

        layout: 'account-10up',

        logoUrl: '/branding/logo.png',

      },

    );

    const printedAt = new Date().toISOString();
    const codesToMark = subjectCode
      ? [subjectCode]
      : [...new Set(rows.map((c) => c.subjectCode))];

    if (onUiChange) {
      onUiChange((u) => {
        for (const code of codesToMark) {
          u.printedSubjects = { ...u.printedSubjects, [code]: printedAt };
        }
      });
    }

    onChange((d) => {
      const nextPrinted = { ...printedSubjects };
      for (const code of codesToMark) nextPrinted[code] = printedAt;
      syncCredentialsPrintedAt(d, nextPrinted);
    });

    toast('Đã mở cửa sổ in phiếu', 'success');

  };



  return (

    <div className="composer-panel">

      <ol className="credentials-steps" style={{ marginBottom: '1rem', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>

        <li><strong>Import DS</strong> — thí sinh đăng ký môn đang setup</li>

        <li><strong>Xếp SBD</strong> — khối + 4 số theo tên; tài khoản 6 số; PIN 8 số</li>

        <li><strong>In phiếu</strong> — bắt buộc trước khi xuất USB</li>

        <li><strong>Xuất 1 ZIP</strong> — copy lên USB niêm phong</li>

      </ol>

      <div className="composer-row" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>

        <button

          type="button"

          className="cbt-btn cbt-btn-primary"

          onClick={() => {
            try {
              onChange((d) => assignCredentials(d, { subjectCode: activeSubject }));
              toast(
                activeSubject
                  ? `Đã xếp SBD cho môn ${SUBJECT_VI[activeSubject] ?? activeSubject}`
                  : 'Đã xếp SBD và gán tài khoản',
                'success',
              );
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Không xếp được SBD', 'error');
            }
          }}

        >

          Xếp SBD & gán tài khoản

        </button>

        <select className="cbt-input" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>

          <option value="">In tất cả môn</option>

          {[...new Set(creds.map((c) => c.subjectCode))].map((code) => (

            <option key={code} value={code}>

              {SUBJECT_VI[code] ?? code}

            </option>

          ))}

        </select>

        <button

          type="button"

          className="cbt-btn cbt-btn-outline"

          disabled={!creds.length}

          onClick={() => print6up(filterSubject || undefined)}

        >

          In phiếu 10-up A4

        </button>

      </div>

      {draft.credentialsAssignedAt && (

        <p className="admin-hint" style={{ color: '#15803d' }}>

          Đã xếp lúc {new Date(draft.credentialsAssignedAt).toLocaleString('vi-VN')}

          {activeSubject && printedSubjects[activeSubject]
            ? ` · Đã in môn này lúc ${new Date(printedSubjects[activeSubject]).toLocaleString('vi-VN')}`
            : draft.credentialsPrintedAt
            ? ` · Đã in lúc ${new Date(draft.credentialsPrintedAt).toLocaleString('vi-VN')}`

            : ' · Chưa in phiếu'}

          {creds.length ? ` · ${creds.length} phiếu (HS×môn)` : ''}

        </p>

      )}

      <table className="cbt-table">

        <thead>

          <tr>

            <th>Môn</th>

            <th>Họ tên</th>

            <th>Lớp</th>

            <th>SBD</th>

            <th>Tài khoản</th>

            <th>PIN</th>

          </tr>

        </thead>

        <tbody>

          {creds.map((c) => (

            <tr key={`${c.examAccount}`}>

              <td>{SUBJECT_VI[c.subjectCode] ?? c.subjectCode}</td>

              <td>{c.fullName}</td>

              <td>{c.className ?? '—'}</td>

              <td>{c.sbd}</td>

              <td>

                <strong>{c.examAccount}</strong>

              </td>

              <td>

                <strong>{c.pin}</strong>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}

