const test = require('node:test');
const assert = require('node:assert/strict');
const { publicIdFromUrl } = require('../utils/imageReferences');

const base = 'https://res.cloudinary.com/demo/image/upload';

test('reads the public ID from stored and resized Cloudinary URLs', () => {
  assert.equal(publicIdFromUrl(`${base}/v1789205631/luvana/tubt5kqveo1gpgxdbsbp.jpg`), 'luvana/tubt5kqveo1gpgxdbsbp');
  assert.equal(publicIdFromUrl(`${base}/f_auto,q_auto,c_limit,w_640/v1789205631/luvana/abc.webp`), 'luvana/abc');
  assert.equal(publicIdFromUrl(`${base}/luvana/no-version.png`), 'luvana/no-version');
  assert.equal(publicIdFromUrl(`${base}/v1/top-level`), 'top-level');
});

test('ignores anything that is not a Cloudinary image URL', () => {
  for (const url of ['', null, undefined, 'ass', '/placeholder.png', 'https://object.pixocial.com/a.jpg', 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4']) {
    assert.equal(publicIdFromUrl(url), null, String(url));
  }
});
