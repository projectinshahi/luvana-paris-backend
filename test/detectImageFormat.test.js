// Run with: npm test  (node:test, no framework)
const test = require('node:test');
const assert = require('node:assert/strict');
const { detectImageFormat } = require('../controller/admin/generalController');

// Real files carry more than a header; pad so the 12-byte minimum is met.
const pad = (b) => Buffer.concat([b, Buffer.alloc(32)]);

const images = {
  jpeg: Buffer.from('ffd8ffe000104a464946', 'hex'),
  png: Buffer.from('89504e470d0a1a0a', 'hex'),
  gif: Buffer.from('GIF89a'),
  webp: Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]),
  bmp: Buffer.from('BM'),
  tiff: Buffer.from('49492a00', 'hex'),
  avif: Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif')]),
  heic: Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic')]),
  svg: Buffer.from('﻿<?xml version="1.0"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg"/>'),
};

for (const [format, head] of Object.entries(images)) {
  test(`identifies ${format} from its bytes, whatever MIME the browser sent`, () => {
    assert.equal(detectImageFormat(pad(head)), format);
  });
}

test('rejects files that are not images', () => {
  assert.equal(detectImageFormat(pad(Buffer.from('hello world, not an image'))), null);
  assert.equal(detectImageFormat(pad(Buffer.from('<html><body>x</body></html>'))), null);
  assert.equal(detectImageFormat(pad(Buffer.from('%PDF-1.4'))), null);
  // an MP4 shares the ftyp box with HEIC/AVIF but is not an image
  assert.equal(detectImageFormat(pad(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom')]))), null);
  assert.equal(detectImageFormat(Buffer.alloc(0)), null);
  assert.equal(detectImageFormat(undefined), null);
});
