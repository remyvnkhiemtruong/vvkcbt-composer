import {
  TN_THPT_SUBJECTS,
  EXAM_PACKAGE_FORMAT_VERSION,
  getDefaultStructure,
  validateSubjectBlueprint,
} from '@vnu/shared-types';
import type {
  ExamPackageExportState,
  ExamPackageQuestionRow,
  ExamPackageStudentRow,
  ExamPackageSubjectRow,
  ExamPackageCredentialRow,
} from '@vnu/shared-types';

const DRAFT_KEY = 'vnu_composer_draft_v1';
const UI_KEY = 'vnu_composer_ui_v1';

export type TnThptSubjectCode =
  | 'LITERATURE'
  | 'MATH'
  | 'ENGLISH'
  | 'PHYSICS'
  | 'CHEMISTRY'
  | 'BIOLOGY'
  | 'GEOGRAPHY'
  | 'HISTORY'
  | 'CIVIC_EDU'
  | 'TECHNOLOGY'
  | 'INFORMATICS';

export interface SealedExportRecord {
  at: string;
  filename: string;
}

export interface ComposerUiState {
  activeSubject?: TnThptSubjectCode;
  sealedExports: Record<string, SealedExportRecord>;
  /** subjectCode → ISO timestamp — đã in phiếu môn đó */
  printedSubjects: Record<string, string>;
}

export function loadComposerUi(): ComposerUiState {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) return { sealedExports: {}, printedSubjects: {}, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { sealedExports: {}, printedSubjects: {} };
}

export function saveComposerUi(ui: ComposerUiState) {
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}

export function ensureSubjectInSchedule(draft: ExamPackageExportState, subjectCode: string) {
  if (draft.subjects.find((s) => s.code === subjectCode)) return;
  const meta = TN_THPT_SUBJECTS.find((s) => s.code === subjectCode);
  if (!meta) return;
  const idx = draft.subjects.length;
  draft.subjects.push({
    code: subjectCode,
    nameVi: meta.nameVi,
    examDate: new Date().toISOString().slice(0, 10),
    startTime: `${String(7 + idx).padStart(2, '0')}:30`,
    endTime: `${String(7 + idx + Math.ceil(meta.durationMin / 60)).padStart(2, '0')}:30`,
    durationMin: meta.durationMin,
    structureMode: 'default',
    ui_mode: meta.uiMode,
  });
}

export function getSubjectSetupStatus(
  draft: ExamPackageExportState,
  subjectCode: string,
  ui: ComposerUiState,
): 'sealed' | 'in_progress' | 'not_started' {
  if (ui.sealedExports[subjectCode]) return 'sealed';
  const hasPaper = !!draft.papers[subjectCode]?.questions?.length;
  const hasStudents = draft.students.some((st) => st.subjects.includes(subjectCode));
  if (hasPaper || hasStudents || draft.subjects.some((s) => s.code === subjectCode)) return 'in_progress';
  return 'not_started';
}

const DEFAULT_BRANDING = {
  soGdName: 'SỞ GDĐT CÀ MAU',
  schoolName: 'TRƯỜNG THPT VÕ VĂN KIỆT',
  logoPath: 'media/branding/logo.png',
};

export function createEmptyDraft(): ExamPackageExportState {
  const packageId = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    manifest: {
      formatVersion: EXAM_PACKAGE_FORMAT_VERSION,
      packageId,
      examName: 'Kỳ thi TN THPT mới',
      createdAt: now,
      mediaManifest: [],
      branding: { ...DEFAULT_BRANDING },
    },
    session: {
      name: 'Kỳ thi TN THPT mới',
      routingMode: 'fixed_combo',
      status: 'active',
      durationMin: 90,
      startAt: now,
      rules: {
        exam_type: 'TN_THPT_2025',
        assessment_period: 'GK2',
        structure: { source: 'QD764', is_custom: false },
        cognitive_distribution: { nhan_biet: 0.4, thong_hieu: 0.3, van_dung: 0.3 },
        subjects: TN_THPT_SUBJECTS.map((s) => ({
          code: s.code,
          structureMode: 'default',
          ui_mode: s.uiMode,
        })),
        scoring: {
          true_false_branch: { '1': 0.1, '2': 0.25, '3': 0.5, '4': 1.0 },
          short_answer_normalize: ['comma_to_dot', 'trim_whitespace'],
        },
        proctoring: {
          max_focus_violations: 3,
          autosave_interval_sec: 3,
          release_mode: 'proctor_at_time',
          grace_before_min: 5,
          grace_after_min: 15,
          require_fullscreen: true,
          block_copy_paste: true,
          block_context_menu: true,
          watermark: true,
          single_active_session: true,
        },
        audio: { max_plays: 2, seek_disabled: true },
      },
    },
    subjects: [],
    students: [],
    clusters: [],
    papers: {},
    credentials: [],
  };
}

export function applyGkCkPreset(draft: ExamPackageExportState, period: 'GK1' | 'GK2' | 'CK1' | 'CK2', subjectCodes: string[]) {
  draft.session.rules.exam_type = 'GDPT_2018';
  draft.session.rules.assessment_period = period;
  draft.session.rules.structure = { source: 'QD764', is_custom: false };
  const selected = TN_THPT_SUBJECTS.filter((s) => subjectCodes.includes(s.code));
  draft.subjects = selected.map((s, idx) => ({
    code: s.code,
    nameVi: s.nameVi,
    examDate: new Date().toISOString().slice(0, 10),
    startTime: `${String(7 + idx).padStart(2, '0')}:30`,
    endTime: `${String(7 + idx + Math.ceil(s.durationMin / 60)).padStart(2, '0')}:30`,
    durationMin: s.durationMin,
    structureMode: 'default',
    ui_mode: s.uiMode,
  }));
  for (const st of draft.students) {
    st.subjects = subjectCodes.filter((c) => st.subjects.includes(c) || subjectCodes.length <= 2);
    if (!st.subjects.length) st.subjects = [...subjectCodes];
  }
}

export function loadDraft(): ExamPackageExportState {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw) as ExamPackageExportState;
  } catch {
    /* ignore */
  }
  return createEmptyDraft();
}

export function saveDraft(draft: ExamPackageExportState) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function registerMediaFile(
  draft: ExamPackageExportState,
  file: File,
  zipPath?: string,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = zipPath ?? `media/${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'application/octet-stream';
  if (!draft.mediaFiles) draft.mediaFiles = [];
  const idx = draft.mediaFiles.findIndex((m) => m.path === path);
  const entry = { path, base64, mimeType };
  if (idx >= 0) draft.mediaFiles[idx] = entry;
  else draft.mediaFiles.push(entry);
  if (!draft.manifest.mediaManifest) draft.manifest.mediaManifest = [];
  if (!draft.manifest.mediaManifest.find((m) => m.path === path)) {
    draft.manifest.mediaManifest.push({ path, checksum: '', mimeType });
  }
  return path;
}

export async function registerBrandingLogo(draft: ExamPackageExportState, file: File) {
  const path = await registerMediaFile(draft, file, 'media/branding/logo.png');
  if (!draft.manifest.branding) {
    draft.manifest.branding = { ...DEFAULT_BRANDING };
  }
  draft.manifest.branding.logoPath = path;
}

export function mediaToken(path: string, kind: 'image' | 'audio'): string {
  return kind === 'audio' ? `[Audio: ${path}]` : `[Ảnh: ${path}]`;
}

export function addQuestion(draft: ExamPackageExportState, q: ExamPackageQuestionRow) {
  const paper = draft.papers[q.subject] ?? {
    title: `Đề ${q.subject}`,
    subject: q.subject,
    questions: [],
    difficultyMeta: {},
  };
  paper.questions.push(q as unknown as Record<string, unknown>);
  draft.papers[q.subject] = paper;
}

export function listQuestions(draft: ExamPackageExportState, subject?: string): ExamPackageQuestionRow[] {
  const out: ExamPackageQuestionRow[] = [];
  for (const [sub, paper] of Object.entries(draft.papers)) {
    if (subject && sub !== subject) continue;
    for (const q of paper.questions) {
      out.push(q as unknown as ExamPackageQuestionRow);
    }
  }
  return out;
}

export function updateQuestion(draft: ExamPackageExportState, q: ExamPackageQuestionRow) {
  for (const paper of Object.values(draft.papers)) {
    const idx = paper.questions.findIndex((x) => (x as { id?: string }).id === q.id);
    if (idx >= 0) {
      paper.questions[idx] = q as unknown as Record<string, unknown>;
      return;
    }
  }
}

export function deleteQuestion(draft: ExamPackageExportState, questionId: string) {
  for (const paper of Object.values(draft.papers)) {
    const idx = paper.questions.findIndex((x) => (x as { id?: string }).id === questionId);
    if (idx >= 0) {
      paper.questions.splice(idx, 1);
      return;
    }
  }
}

export function getDefaultPartForType(subject: string, type: string): string | undefined {
  const structure = getDefaultStructure(subject);
  if (!structure) return undefined;
  for (const [partKey, cfg] of Object.entries(structure.parts)) {
    if (cfg.type === type) return partKey;
  }
  return undefined;
}

export function getQd764QuestionCount(subject: string): number {
  const structure = getDefaultStructure(subject);
  if (!structure) return 0;
  if (subject === 'LITERATURE') return 2;
  if (subject === 'ENGLISH') return structure.parts.part1_cluster_mcq?.count ?? 40;
  return Object.values(structure.parts).reduce(
    (n, p) => n + (p.count ?? (p.type === 'essay' ? 1 : 0)),
    0,
  );
}

export function rebuildPaperFromQuestions(draft: ExamPackageExportState, subject: string, questionIds: string[]) {
  const allQs: ExamPackageQuestionRow[] = [];
  Object.values(draft.papers).forEach((p) => {
    p.questions.forEach((q) => {
      const id = (q as { id?: string }).id;
      if (id) allQs.push(q as unknown as ExamPackageQuestionRow);
    });
  });
  const selected = questionIds
    .map((id) => allQs.find((q) => q.id === id))
    .filter(Boolean) as ExamPackageQuestionRow[];
  draft.papers[subject] = {
    title: `Đề ${subject}`,
    subject,
    questions: selected as unknown as Record<string, unknown>[],
    difficultyMeta: {},
  };
}

export function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    h = (Math.imul(1664525, h) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generatePaperFromBank(
  draft: ExamPackageExportState,
  subject: string,
  count?: number,
): void {
  if (subject === 'ENGLISH') {
    generateEnglishPaperFromClusters(draft);
    return;
  }
  if (subject === 'LITERATURE') {
    generateLiteraturePaper(draft);
    return;
  }
  const pool: ExamPackageQuestionRow[] = [];
  Object.values(draft.papers).forEach((p) => {
    p.questions.forEach((q) => {
      const row = q as unknown as ExamPackageQuestionRow;
      if ((row.subject ?? subject) === subject && row.id) pool.push(row);
    });
  });
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  const target = count ?? getQd764QuestionCount(subject);
  const seed = `${draft.manifest.packageId}:${subject}`;
  const picked = seededShuffle(unique, seed).slice(0, Math.min(target, unique.length));
  draft.papers[subject] = {
    title: `Đề ${subject}`,
    subject,
    questions: picked as unknown as Record<string, unknown>[],
    difficultyMeta: {},
  };
}

export const ENGLISH_CLUSTER_ORDER = [
  'fill_notice',
  'fill_flyer',
  'reorder',
  'fill_gap',
  'reading_8',
  'reading_10',
] as const;

/** Ghép đề Anh theo thứ tự 6 cluster QĐ764 — không shuffle. */
export function generateEnglishPaperFromClusters(draft: ExamPackageExportState): void {
  const layout = getDefaultStructure('ENGLISH')?.clusterLayout;
  const allQs = (draft.papers.ENGLISH?.questions ?? []) as ExamPackageQuestionRow[];
  const ordered: ExamPackageQuestionRow[] = [];

  for (const subtype of ENGLISH_CLUSTER_ORDER) {
    const clusterQs = allQs
      .filter((q) => (q as { clusterSubtype?: string }).clusterSubtype === subtype)
      .sort((a, b) => (a.clusterOrder ?? 0) - (b.clusterOrder ?? 0));
    ordered.push(...clusterQs);
  }

  const orphans = allQs.filter(
    (q) => !ENGLISH_CLUSTER_ORDER.includes((q as { clusterSubtype?: string }).clusterSubtype as typeof ENGLISH_CLUSTER_ORDER[number]),
  );
  ordered.push(...orphans);

  draft.papers.ENGLISH = {
    title: 'Đề ENGLISH',
    subject: 'ENGLISH',
    questions: ordered as unknown as Record<string, unknown>[],
    difficultyMeta: {},
  };

  if (layout) {
    for (const item of layout.clusters) {
      const cluster = (draft.clusters ?? []).find((c) => c.clusterSubtype === item.subtype);
      if (cluster) {
        const ids = ordered
          .filter((q) => (q as { clusterSubtype?: string }).clusterSubtype === item.subtype)
          .map((q) => q.id);
        cluster.questionIds = ids;
      }
    }
  }
}

function generateLiteraturePaper(draft: ExamPackageExportState): void {
  const pool = listQuestions(draft, 'LITERATURE');
  const reading = pool.find((q) => q.part === 'part1_reading');
  const writing = pool.find((q) => q.part === 'part2_writing');
  const picked = [reading, writing].filter(Boolean) as ExamPackageQuestionRow[];
  draft.papers.LITERATURE = {
    title: 'Đề LITERATURE',
    subject: 'LITERATURE',
    questions: picked as unknown as Record<string, unknown>[],
    difficultyMeta: {},
  };
}

export interface ClusterProgressRow {
  subtype: string;
  expected: number;
  actual: number;
  hasPassage: boolean;
  ok: boolean;
}

export function getClusterProgress(draft: ExamPackageExportState): ClusterProgressRow[] {
  const layout = getDefaultStructure('ENGLISH')?.clusterLayout;
  if (!layout) return [];
  const qs = (draft.papers.ENGLISH?.questions ?? []) as { clusterSubtype?: string }[];

  return layout.clusters.map((item) => {
    const cluster = (draft.clusters ?? []).find((c) => c.clusterSubtype === item.subtype);
    const passage = String((cluster?.passage as { text?: string })?.text ?? '').trim();
    const actual = qs.filter((q) => q.clusterSubtype === item.subtype).length;
    return {
      subtype: item.subtype,
      expected: item.count,
      actual,
      hasPassage: passage.length > 0,
      ok: actual === item.count && passage.length > 0,
    };
  });
}

export function getBankPartProgress(
  draft: ExamPackageExportState,
  subject: string,
): ComposerPartProgress[] {
  const structure = getDefaultStructure(subject);
  if (!structure) return [];
  const bank = listQuestions(draft, subject);
  return Object.entries(structure.parts).map(([partKey, cfg]) => {
    const count = bank.filter((q) => q.part === partKey || (!q.part && q.type === cfg.type)).length;
    const expected = cfg.count ?? (cfg.type === 'essay' ? 1 : 0);
    return { partKey, expected, count, ok: count >= expected };
  });
}

const VALID_GRADES = ['10', '11', '12'] as const;

/** Lấy khối 10/11/12 từ cột Lớp (vd. 10A1 → 10). */
export function parseGradeFromClassName(className: string): string | null {
  const m = className?.trim().match(/^(\d{2})/);
  if (!m) return null;
  const grade = m[1];
  return (VALID_GRADES as readonly string[]).includes(grade) ? grade : null;
}

/** Xếp SBD = khối + 4 số theo thứ tự họ tên trong từng khối. */
export function assignSbdByGrade(students: ExamPackageStudentRow[]): { errors: string[] } {
  const errors: string[] = [];
  const invalid: string[] = [];
  for (const st of students) {
    if (!parseGradeFromClassName(st.className ?? '')) {
      invalid.push(st.fullName);
    }
  }
  if (invalid.length) {
    errors.push(
      `Không parse được khối từ cột Lớp (cần bắt đầu bằng 10, 11 hoặc 12): ${invalid.join(', ')}`,
    );
    return { errors };
  }

  const byGrade = new Map<string, ExamPackageStudentRow[]>();
  for (const st of students) {
    const grade = parseGradeFromClassName(st.className!)!;
    const list = byGrade.get(grade) ?? [];
    list.push(st);
    byGrade.set(grade, list);
  }

  for (const grade of VALID_GRADES) {
    const group = byGrade.get(grade);
    if (!group?.length) continue;
    group.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
    group.forEach((st, idx) => {
      st.sbd = `${grade}${String(idx + 1).padStart(4, '0')}`;
    });
  }
  return { errors };
}

function generatePin(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

/** Sinh N tài khoản 6 chữ số, không trùng nhau trong batch. */
export function generateUniqueExamAccounts(count: number, reserved = new Set<string>()): string[] {
  const used = new Set(reserved);
  const out: string[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 200) {
    guard++;
    const acct = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(acct)) {
      used.add(acct);
      out.push(acct);
    }
  }
  if (out.length < count) {
    throw new Error(`Không đủ mã tài khoản 6 số (cần ${count}, có ${out.length})`);
  }
  return out;
}

function assignLabRoom(index: number, roomBase = 'Phòng máy số 1', capacity = 30): string {
  const roomNum = Math.floor(index / capacity) + 1;
  return roomNum === 1 ? roomBase : `${roomBase} — máy ${roomNum}`;
}

/** v1.2: SBD khối+4 số; một tài khoản 6 số + PIN 8 số / (HS × môn) */
export function assignCredentials(
  draft: ExamPackageExportState,
  opts?: { roomBase?: string; roomCapacity?: number; subjectCode?: string },
) {
  const sbdResult = assignSbdByGrade(draft.students);
  if (sbdResult.errors.length) {
    throw new Error(sbdResult.errors.join('\n'));
  }

  const subjectFilter = opts?.subjectCode;
  const sorted = [...draft.students]
    .filter((st) => !subjectFilter || st.subjects.includes(subjectFilter))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));

  sorted.forEach((st, i) => {
    st.labRoom = assignLabRoom(i, opts?.roomBase, opts?.roomCapacity);
  });

  const subjectsForCreds = (st: ExamPackageStudentRow) =>
    subjectFilter ? st.subjects.filter((s) => s === subjectFilter) : st.subjects;

  const slotCount = sorted.reduce((n, st) => n + subjectsForCreds(st).length, 0);
  const accounts = generateUniqueExamAccounts(slotCount);
  let acctIdx = 0;

  const existingOther = (draft.credentials ?? []).filter(
    (c) => !subjectFilter || c.subjectCode !== subjectFilter,
  );
  const credentials: ExamPackageCredentialRow[] = [...existingOther];
  for (const st of sorted) {
    for (const sub of subjectsForCreds(st)) {
      credentials.push({
        studentCode: st.studentCode,
        fullName: st.fullName,
        className: st.className,
        subjectCode: sub,
        sbd: st.sbd!,
        examAccount: accounts[acctIdx++],
        pin: generatePin(),
        labRoom: st.labRoom,
        dateOfBirth: st.dateOfBirth,
        gender: st.gender,
      });
    }
  }
  draft.credentials = credentials;
  draft.credentialsAssignedAt = new Date().toISOString();
  if (!subjectFilter) {
    draft.credentialsPrintedAt = undefined;
  }
}

/** Đồng bộ credentialsPrintedAt legacy từ printedSubjects */
export function syncCredentialsPrintedAt(
  draft: ExamPackageExportState,
  printedSubjects: Record<string, string>,
) {
  const times = Object.values(printedSubjects).filter(Boolean);
  draft.credentialsPrintedAt = times.length ? times.sort().reverse()[0] : undefined;
}

export function credentialsReady(
  draft: ExamPackageExportState,
  subjectCode?: string,
  ui?: Pick<ComposerUiState, 'printedSubjects'>,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const students = subjectCode
    ? draft.students.filter((st) => st.subjects.includes(subjectCode))
    : draft.students;
  if (!students.length) errors.push(subjectCode ? `Chưa có thí sinh môn ${subjectCode}` : 'Chưa có thí sinh');
  const creds = (draft.credentials ?? []).filter(
    (c) => !subjectCode || c.subjectCode === subjectCode,
  );
  if (creds.length) {
    const seen = new Set<string>();
    for (const c of creds) {
      if (!c.examAccount?.trim()) errors.push(`Thiếu tài khoản: ${c.fullName}/${c.subjectCode}`);
      else if (!/^\d{6}$/.test(c.examAccount.trim())) {
        errors.push(`Tài khoản phải 6 chữ số: ${c.examAccount} (${c.fullName})`);
      } else if (seen.has(c.examAccount)) {
        errors.push(`Tài khoản trùng: ${c.examAccount}`);
      } else {
        seen.add(c.examAccount);
      }
      if (!c.pin?.trim()) errors.push(`Thiếu PIN: ${c.fullName}/${c.subjectCode}`);
      else if (!/^\d{8}$/.test(c.pin.trim())) {
        errors.push(`PIN phải 8 chữ số: ${c.fullName}/${c.subjectCode}`);
      }
      if (!c.sbd?.trim()) errors.push(`Thiếu SBD: ${c.fullName}/${c.subjectCode}`);
      else if (!/^\d{6}$/.test(c.sbd.trim())) {
        errors.push(`SBD phải 6 chữ số: ${c.sbd} (${c.fullName})`);
      } else {
        const grade = parseGradeFromClassName(c.className ?? '');
        if (grade && !c.sbd.trim().startsWith(grade)) {
          errors.push(`SBD ${c.sbd} không khớp khối lớp ${c.className} (${c.fullName})`);
        }
      }
    }
  } else {
    for (const st of students) {
      if (!st.sbd?.trim()) errors.push(`Thiếu SBD: ${st.fullName}`);
      else if (!/^\d{6}$/.test(st.sbd.trim())) {
        errors.push(`SBD phải 6 chữ số: ${st.sbd} (${st.fullName})`);
      }
      if (!st.pin?.trim()) errors.push(`Thiếu PIN: ${st.fullName}`);
    }
  }
  if (!draft.credentialsAssignedAt) errors.push('Chưa xếp SBD & gán PIN');
  if (subjectCode) {
    if (!ui?.printedSubjects?.[subjectCode]) {
      errors.push(`Chưa in phiếu môn ${subjectCode} — in phiếu trước khi xuất ZIP`);
    }
  } else {
    const subjectCodes = [...new Set((draft.credentials ?? []).map((c) => c.subjectCode))];
    const missingPrint = subjectCodes.filter((sc) => !ui?.printedSubjects?.[sc]);
    if (missingPrint.length) {
      errors.push(`Chưa in phiếu: ${missingPrint.join(', ')}`);
    } else if (!draft.credentialsPrintedAt) {
      errors.push('Chưa in phiếu — in phiếu trước khi xuất ZIP');
    }
  }
  return { ok: errors.length === 0, errors };
}

export interface ComposerPartProgress {
  partKey: string;
  expected: number;
  count: number;
  ok: boolean;
}

export interface ComposerSubjectProgress {
  subjectCode: string;
  questionCount: number;
  bankCount: number;
  blueprintOk: boolean;
  errors: string[];
  partProgress: ComposerPartProgress[];
}

export function getComposerProgress(
  draft: ExamPackageExportState,
  activeSubject?: string,
): {
  subjects: ComposerSubjectProgress[];
  enabledCount: number;
  blueprintOkCount: number;
  nextStepHint: string;
  nextTab: 'schedule' | 'questions' | 'papers' | 'students' | 'credentials' | 'export' | 'config';
} {
  const enabledCodes = activeSubject
    ? draft.subjects.filter((s) => s.code === activeSubject).map((s) => s.code)
    : draft.subjects.map((s) => s.code);
  const subjects: ComposerSubjectProgress[] = enabledCodes.map((code) => {
    const paper = draft.papers[code];
    const structure = getDefaultStructure(code);
    const questionCount = paper?.questions?.length ?? 0;
    const bankCount = listQuestions(draft, code).length;
    const bp = paper?.questions?.length
      ? validateSubjectBlueprint({
          subjectCode: code,
          paper,
          clusters: draft.clusters,
          mediaManifest: draft.manifest.mediaManifest,
        })
      : { valid: false, errors: ['Chưa sinh đề'] };

    const partProgress: ComposerPartProgress[] = structure
      ? Object.entries(structure.parts).map(([partKey, cfg]) => {
          const qs = (paper?.questions ?? []) as { part?: string; type?: string }[];
          const count = qs.filter((q) => q.part === partKey || (!q.part && q.type === cfg.type)).length;
          const expected = cfg.count ?? (cfg.type === 'essay' ? 1 : 0);
          return { partKey, expected, count, ok: count === expected };
        })
      : [];

    return {
      subjectCode: code,
      questionCount,
      bankCount,
      blueprintOk: bp.valid,
      errors: bp.errors,
      partProgress,
    };
  });

  const blueprintOkCount = subjects.filter((s) => s.blueprintOk).length;
  const bankCount = enabledCodes.reduce((n, code) => n + listQuestions(draft, code).length, 0);

  let nextStepHint = 'Chọn môn đang setup (banner hoặc tab Lịch thi)';
  let nextTab: 'schedule' | 'questions' | 'papers' | 'students' | 'credentials' | 'export' | 'config' = 'schedule';

  if (activeSubject && !enabledCodes.length) {
    nextStepHint = 'Đặt lịch khung giờ cho môn đang setup';
    nextTab = 'schedule';
  } else if (!activeSubject) {
    nextStepHint = 'Chọn môn đang setup';
    nextTab = 'schedule';
  } else if (!enabledCodes.length) {
    nextStepHint = 'Bật ít nhất một môn trong Lịch thi & mở đề';
    nextTab = 'schedule';
  } else if (bankCount === 0) {
    const hasEnglish = enabledCodes.includes('ENGLISH');
    const hasLit = enabledCodes.includes('LITERATURE');
    if (hasEnglish && getClusterProgress(draft).every((p) => !p.ok)) {
      nextStepHint = 'Soạn 6 cluster Tiếng Anh (passage + câu) ở tab Soạn câu hỏi';
    } else if (hasLit && !listQuestions(draft, 'LITERATURE').length) {
      nextStepHint = 'Soạn 2 bài tự luận Văn (Đọc hiểu + Viết) ở tab Soạn câu hỏi';
    } else {
      nextStepHint = 'Nhập câu hỏi (soạn tay hoặc Nhập từ Word) ở tab Soạn câu hỏi';
    }
    nextTab = 'questions';
  } else if (blueprintOkCount < enabledCodes.length) {
    nextStepHint = 'Bấm Sinh đề chuẩn QĐ764 ở tab Ghép đề cho từng môn';
    nextTab = 'papers';
  } else if (!draft.students.length) {
    nextStepHint = 'Thêm danh sách thí sinh (Import Excel) ở tab Thí sinh';
    nextTab = 'students';
  } else if (!credentialsReady(draft).ok) {
    nextStepHint = 'Xếp SBD, gán tài khoản và in phiếu ở tab SBD & phiếu';
    nextTab = 'credentials';
  } else {
    nextStepHint = 'Kiểm tra và xuất ZIP ở tab Xuất ZIP';
    nextTab = 'export';
  }

  return {
    subjects,
    enabledCount: enabledCodes.length,
    blueprintOkCount,
    nextStepHint,
    nextTab,
  };
}

export type { ExamPackageStudentRow, ExamPackageSubjectRow, ExamPackageQuestionRow, ExamPackageCredentialRow };
