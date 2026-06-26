/**
 * Generates public/mau-de-word-mcq.docx — run: node scripts/create-sample-docx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const tmp = path.join(publicDir, '_docx_tmp');
const out = path.join(publicDir, 'mau-de-word-mcq.docx');

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(path.join(tmp, '_rels'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'word', '_rels'), { recursive: true });

const body = `Câu 1. Tính 2 + 2?
A. 3
B. 4
C. 5
D. 6
Đáp án: B

Câu 2. Thủ đô Việt Nam?
A. Hà Nội
B. TP.HCM
C. Đà Nẵng
D. Huế
Đáp án: A`;

fs.writeFileSync(
  path.join(tmp, '[Content_Types].xml'),
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
);
fs.writeFileSync(
  path.join(tmp, '_rels', '.rels'),
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
);
fs.writeFileSync(path.join(tmp, 'word', '_rels', 'document.xml.rels'), '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
fs.writeFileSync(
  path.join(tmp, 'word', 'document.xml'),
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p></w:body></w:document>`,
);

const zipPath = `${out}.zip`;
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
if (fs.existsSync(out)) fs.unlinkSync(out);
execSync(`powershell -Command "Compress-Archive -Path '${tmp}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
fs.renameSync(zipPath, out);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Created', out);
