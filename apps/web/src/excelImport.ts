import * as XLSX from 'xlsx';
import type { ExamPackageStudentRow } from '@vnu/shared-types';
import { TN_THPT_SUBJECTS } from '@vnu/shared-types';

const SUBJECT_BY_HEADER = new Map(TN_THPT_SUBJECTS.map((s) => [s.nameVi, s.code]));

const HEADER_ALIASES: Record<string, string> = {
  'họ tên': 'fullName',
  'ho ten': 'fullName',
  ten: 'fullName',
  fullname: 'fullName',
  sbd: 'sbd',
  lớp: 'className',
  lop: 'className',
  classname: 'className',
  'ngày sinh': 'dateOfBirth',
  'ngay sinh': 'dateOfBirth',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
  'giới tính': 'gender',
  'gioi tinh': 'gender',
  gender: 'gender',
  'mã hs': 'studentCode',
  'ma hs': 'studentCode',
  'mã học sinh': 'studentCode',
  'ma hoc sinh': 'studentCode',
  studentcode: 'studentCode',
  'tổ hợp': 'comboCode',
  'to hop': 'comboCode',
  combocode: 'comboCode',
  'môn thi': 'subjectsRaw',
  'mon thi': 'subjectsRaw',
  subjects: 'subjectsRaw',
  'ghi chú': 'note',
  'ghi chu': 'note',
  note: 'note',
  phòng: 'labRoom',
  phong: 'labRoom',
  labroom: 'labRoom',
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isMarkedX(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'x' || v === '1' || v === '✓' || v === '√' || v === 'yes' || v === 'có' || v === 'co';
}

function formatDateOfBirth(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmY) {
    const d = dmY[1].padStart(2, '0');
    const m = dmY[2].padStart(2, '0');
    return `${dmY[3]}-${m}-${d}`;
  }
  if (typeof raw === 'number' || /^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(epoch.getTime() + n * 86400000);
    return dt.toISOString().slice(0, 10);
  }
  return s;
}

function normalizeGender(raw: string): string | undefined {
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (v === 'nam' || v === 'm' || v === 'male') return 'Nam';
  if (v === 'nữ' || v === 'nu' || v === 'n' || v === 'female' || v === 'f') return 'Nữ';
  return raw.trim();
}

function parseSubjectsFromRow(
  row: Record<string, string>,
  subjectCols: Map<string, string>,
): string[] {
  const subjects = new Set<string>();
  for (const [header, code] of subjectCols) {
    if (isMarkedX(row[header] ?? '')) subjects.add(code);
  }
  return [...subjects];
}

function resolveSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  const preferred = wb.SheetNames.find(
    (n) => normHeader(n) === 'danhsachthisinh' || n === 'DanhSachThiSinh',
  );
  return wb.Sheets[preferred ?? wb.SheetNames[0]];
}

/** Xác định đúng một môn có cột X trong file Excel (import theo môn). */
export function detectImportSubject(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = resolveSheet(wb);
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as (string | number)[][];
  if (!matrix.length) {
    throw new Error('Mỗi file Excel chỉ dùng cho một môn — file trống');
  }
  const headerRow = matrix[0].map((c) => String(c ?? '').trim());
  const subjectCols = new Map<string, string>();
  headerRow.forEach((h) => {
    if (!h) return;
    const subjectCode = SUBJECT_BY_HEADER.get(h) ?? SUBJECT_BY_HEADER.get(h.trim());
    if (subjectCode) subjectCols.set(h, subjectCode);
  });
  const marked = new Set<string>();
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    headerRow.forEach((h, idx) => {
      const code = subjectCols.get(h);
      if (code && isMarkedX(String(cells[idx] ?? ''))) marked.add(code);
    });
  }
  if (marked.size === 0) {
    throw new Error('Mỗi file Excel chỉ dùng cho một môn — không có cột môn nào được đánh dấu X');
  }
  if (marked.size > 1) {
    throw new Error('Mỗi file Excel chỉ dùng cho một môn — phát hiện nhiều hơn một môn có X');
  }
  return [...marked][0];
}

export function parseStudentsExcel(buffer: ArrayBuffer): ExamPackageStudentRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = resolveSheet(wb);
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as (string | number)[][];

  if (!matrix.length) return [];

  const headerRow = matrix[0].map((c) => String(c ?? '').trim());
  const canonical: Record<number, string> = {};
  const subjectCols = new Map<string, string>();

  headerRow.forEach((h, idx) => {
    if (!h) return;
    const norm = normHeader(h);
    const subjectCode = SUBJECT_BY_HEADER.get(h) ?? SUBJECT_BY_HEADER.get(h.trim());
    if (subjectCode) {
      subjectCols.set(h, subjectCode);
      return;
    }
    const field = HEADER_ALIASES[norm];
    if (field) canonical[idx] = field;
  });

  const results: ExamPackageStudentRow[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const values: Record<string, string> = {};
    Object.entries(canonical).forEach(([idx, field]) => {
      values[field] = String(cells[Number(idx)] ?? '').trim();
    });

    const rowByHeader: Record<string, string> = {};
    headerRow.forEach((h, idx) => {
      if (h) rowByHeader[h] = String(cells[idx] ?? '').trim();
    });

    const fullName = values.fullName ?? '';
    if (!fullName) continue;

    const sbd = values.sbd || undefined;
    const studentCode =
      values.studentCode || sbd || `HS${String(r).padStart(4, '0')}`;
    let subjects = parseSubjectsFromRow(rowByHeader, subjectCols);
    const subjectsRaw = values.subjectsRaw ?? '';
    if (!subjects.length && subjectsRaw) {
      subjects = subjectsRaw
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const key = s.toLowerCase();
          for (const [name, code] of SUBJECT_BY_HEADER) {
            if (name.toLowerCase() === key || code.toLowerCase() === key) return code;
          }
          return s.toUpperCase();
        });
    }
    if (!subjects.length) {
      subjects = ['LITERATURE', 'MATH'];
    }

    results.push({
      fullName,
      studentCode,
      className: values.className || undefined,
      dateOfBirth: formatDateOfBirth(values.dateOfBirth ?? ''),
      gender: normalizeGender(values.gender ?? ''),
      subjects,
      comboCode: values.comboCode || undefined,
      sbd,
      labRoom: values.labRoom || undefined,
      note: values.note || undefined,
    });
  }

  return results;
}

export function buildStudentTemplateExcel(): Blob {
  const headers = [
    'Họ tên',
    'SBD',
    'Lớp',
    'Ngày sinh',
    'Giới tính',
    ...TN_THPT_SUBJECTS.map((s) => s.nameVi),
    'Ghi chú',
  ];
  const rowA: (string | number)[] = [
    'Nguyễn Văn A',
    '1001',
    '12A1',
    '15/03/2008',
    'Nam',
    ...TN_THPT_SUBJECTS.map((s) => (s.mandatory ? 'X' : '')),
    '',
  ];
  const rowB: (string | number)[] = [
    'Trần Thị B',
    '1002',
    '12A1',
    '20/07/2008',
    'Nữ',
    'X',
    'X',
    'X',
    'X',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, rowA, rowB]);
  ws['!cols'] = headers.map((h, i) => ({
    wch: i < 5 ? 14 : h.length > 8 ? 10 : 8,
  }));

  const guide = XLSX.utils.aoa_to_sheet([
    ['HƯỚNG DẪN'],
    ['Đánh dấu X vào cột môn thí sinh đăng ký (Toán, Văn bắt buộc).'],
    ['Ngày sinh: dd/mm/yyyy. Giới tính: Nam hoặc Nữ.'],
    ['SBD có thể để trống — hệ thống tự xếp khi gán tài khoản.'],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachThiSinh');
  XLSX.utils.book_append_sheet(wb, guide, 'HuongDan');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Exported for tests */
export { isMarkedX, formatDateOfBirth, SUBJECT_BY_HEADER };
