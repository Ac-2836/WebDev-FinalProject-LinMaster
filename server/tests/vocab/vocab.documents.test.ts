import {deflateRawSync} from 'node:zlib';
import express from 'express';
import request from 'supertest';
import {beforeEach, describe, expect, it} from 'vitest';
import type {VocabDocument} from '@linmaster/shared';
import {errorMiddleware} from '../../src/core/error.middleware';
import {generateOpenApiDocument} from '../../src/core/openapi-registry';
import {signJwt} from '../../src/core/jwt';
import {createVocabModule} from '../../src/modules/vocab';
import type {VocabDocumentRepository} from '../../src/modules/vocab/documents.repository';

const JWT_SECRET = 'documents-test-secret-that-is-at-least-32-characters';
const USER_ID = '0192f7e0-0bcd-7000-8000-000000000011';
const OTHER_USER_ID = '0192f7e0-0bcd-7000-8000-000000000012';
const DOCUMENT_ID = '0192f7e0-0bcd-7000-8000-000000000013';
const OTHER_DOCUMENT_ID = '0192f7e0-0bcd-7000-8000-000000000014';

function makeDocument(overrides: Partial<VocabDocument> = {}): VocabDocument {
  return {
    id: DOCUMENT_ID,
    title: 'Sample article',
    source: 'paste',
    paragraphs: [{text: 'A sample paragraph.'}],
    wordCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDocumentRepository(): VocabDocumentRepository & {
  documents: Map<string, {ownerId: string; document: VocabDocument}>;
} {
  const documents = new Map<string, {ownerId: string; document: VocabDocument}>();
  documents.set(OTHER_DOCUMENT_ID, {ownerId: OTHER_USER_ID, document: makeDocument({id: OTHER_DOCUMENT_ID})});

  return {
    documents,
    async createDocument(ownerId, input) {
      const id = documents.has(DOCUMENT_ID) ? '0192f7e0-0bcd-7000-8000-000000000015' : DOCUMENT_ID;
      const document = makeDocument({...input, id});
      documents.set(id, {ownerId, document});
      return document;
    },
    async listDocuments(ownerId) {
      return [...documents.values()]
        .filter(value => value.ownerId === ownerId)
        .map(({document}) => ({
          id: document.id,
          title: document.title,
          source: document.source,
          wordCount: document.wordCount,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        }));
    },
    async findDocument(ownerId, id) {
      const record = documents.get(id);
      if (record?.ownerId !== ownerId) return null;
      return {...record.document, entries: []};
    },
    async getDocumentForUser(ownerId, id) {
      const record = documents.get(id);
      return record?.ownerId === ownerId ? record.document : null;
    },
    async findExamDocument() {
      return null;
    },
    async deleteDocument(ownerId, id) {
      const record = documents.get(id);
      if (record?.ownerId !== ownerId) return false;
      documents.delete(id);
      return true;
    },
  };
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createDocx(text: string): Buffer {
  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const files = [
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: 'word/document.xml',
      content: `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapedText}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`,
    },
  ];
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name);
    const raw = Buffer.from(file.content);
    const compressed = deflateRawSync(raw);
    const checksum = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    localRecords.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const central = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localRecords, central, end]);
}

function createPdf(text: string): Buffer {
  const escapedText = text.replace(/([\\()])/g, '\\$1');
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapedText}) Tj\nET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function createPdfWithParagraphs(paragraphs: string[]): Buffer {
  const commands = paragraphs
    .map((paragraph, index) => `1 0 0 1 72 ${720 - index * 36} Tm\n(${paragraph.replace(/([\\()])/g, '\\$1')}) Tj\n`)
    .join('');
  const stream = `BT\n/F1 12 Tf\n${commands}ET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function createTestServer(repository: VocabDocumentRepository) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createVocabModule(JWT_SECRET, undefined, repository).router);
  app.use(errorMiddleware);
  return app;
}

function authHeader(userId = USER_ID) {
  return `Bearer ${signJwt(userId, JWT_SECRET)}`;
}

describe('vocab documents API', () => {
  let repository: ReturnType<typeof makeDocumentRepository>;
  let app: express.Express;

  beforeEach(() => {
    repository = makeDocumentRepository();
    app = createTestServer(repository);
  });

  it('creates pasted text, lists documents, returns detail, and deletes only the owned document', async () => {
    const created = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .send({title: 'Reading', text: 'First paragraph.\n\nSecond paragraph with words.'});
    const listed = await request(app).get('/api/v1/vocab/documents').set('Authorization', authHeader());
    const detail = await request(app).get(`/api/v1/vocab/documents/${DOCUMENT_ID}`).set('Authorization', authHeader());
    const foreignDetail = await request(app)
      .get(`/api/v1/vocab/documents/${OTHER_DOCUMENT_ID}`)
      .set('Authorization', authHeader());
    const foreignDelete = await request(app)
      .delete(`/api/v1/vocab/documents/${OTHER_DOCUMENT_ID}`)
      .set('Authorization', authHeader());
    const deleted = await request(app)
      .delete(`/api/v1/vocab/documents/${DOCUMENT_ID}`)
      .set('Authorization', authHeader());

    expect(created.status).toBe(201);
    expect(created.body.document.paragraphs.map((paragraph: {text: string}) => paragraph.text)).toEqual([
      'First paragraph.',
      'Second paragraph with words.',
    ]);
    expect(created.body.document.wordCount).toBe(6);
    expect(listed.body.documents).toHaveLength(1);
    expect(detail.body.document.entries).toEqual([]);
    expect(foreignDetail.status).toBe(404);
    expect(foreignDelete.status).toBe(404);
    expect(repository.documents.has(OTHER_DOCUMENT_ID)).toBe(true);
    expect(deleted.body).toEqual({deleted: true});
  });

  it.each([
    ['PDF', 'sample.pdf', 'application/pdf', () => createPdf('PDF extraction works.'), 'PDF extraction works.'],
    [
      'DOCX',
      'sample.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      () => createDocx('DOCX extraction works.'),
      'DOCX extraction works.',
    ],
    [
      'TXT',
      'sample.txt',
      'text/markdown',
      () => Buffer.from('\uFEFFTXT extraction works.', 'utf8'),
      'TXT extraction works.',
    ],
  ])('extracts the expected text from a sample %s file', async (_type, filename, mimeType, makeFile, expectedText) => {
    const response = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .field('title', 'Sample upload')
      .attach('file', makeFile(), {filename, contentType: mimeType});

    expect(response.status).toBe(201);
    expect(response.body.document.source).toBe('file');
    expect(response.body.document.paragraphs.map((paragraph: {text: string}) => paragraph.text).join(' ')).toContain(
      expectedText,
    );
  });

  it('uses Vietnamese upload filenames as titles and accepts DOCX with a generic browser MIME', async () => {
    const response = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .attach('file', createDocx('Tài liệu tiếng Việt.'), {
        filename: 'Bài đọc mẫu.docx',
        contentType: 'application/octet-stream',
      });

    expect(response.status).toBe(201);
    expect(response.body.document.title).toBe('Bài đọc mẫu');
  });

  it('splits PDF paragraphs using vertical whitespace within a page', async () => {
    const response = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .attach('file', createPdfWithParagraphs(['Short opening paragraph.', 'Second paragraph.', 'Third paragraph.']), {
        filename: 'paragraphs.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(201);
    const extractedParagraphs = response.body.document.paragraphs.map((paragraph: {text: string}) => paragraph.text);
    expect(extractedParagraphs).toHaveLength(3);
    expect(extractedParagraphs[0].split(/\s+/u)).toHaveLength(3);
  });

  it('returns 400 for an incomplete multipart upload', async () => {
    const response = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .set('Content-Type', 'multipart/form-data; boundary=truncated')
      .send('--truncated\r\nContent-Disposition: form-data; name="file"; filename="broken.txt"\r\n\r\npartial');

    expect(response.status).toBe(400);
  });

  it('rejects an unsupported extension, invalid PDF content, and files larger than 5 MB', async () => {
    const unsupported = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('not a document'), {filename: 'sample.bin', contentType: 'application/octet-stream'});
    const invalidPdf = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('not a PDF'), {filename: 'sample.pdf', contentType: 'application/pdf'});
    const tooLarge = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 65), {filename: 'large.txt', contentType: 'text/plain'});

    expect(unsupported.status).toBe(415);
    expect(invalidPdf.status).toBe(400);
    expect(tooLarge.status).toBe(413);
  });

  it('accepts a long Vietnamese title within the document schema limit', async () => {
    const title = '\u1ea5'.repeat(80);
    const response = await request(app)
      .post('/api/v1/vocab/documents')
      .set('Authorization', authHeader())
      .field('title', title)
      .attach('file', Buffer.from('Vietnamese title body.', 'utf8'), {
        filename: 'title.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(201);
    expect(response.body.document.title).toBe(title);
  });

  it('requires authentication and documents every document endpoint and upload content type', async () => {
    const unauthenticated = await request(app).get('/api/v1/vocab/documents');
    const document = generateOpenApiDocument();

    expect(unauthenticated.status).toBe(401);
    expect(document.paths?.['/api/v1/vocab/documents']?.post).toMatchObject({
      security: [{bearerAuth: []}],
      requestBody: {
        content: {
          'application/json': {schema: expect.any(Object)},
          'multipart/form-data': {schema: expect.any(Object)},
        },
      },
    });
    expect(document.paths?.['/api/v1/vocab/documents']?.get).toBeDefined();
    expect(document.paths?.['/api/v1/vocab/documents/{id}']?.get).toBeDefined();
    expect(document.paths?.['/api/v1/vocab/documents/{id}']?.delete).toBeDefined();
    expect(JSON.stringify(document.paths?.['/api/v1/vocab/documents']?.post)).toContain('binary');
  });
});
