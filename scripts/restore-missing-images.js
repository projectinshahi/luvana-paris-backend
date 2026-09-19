// Finds image URLs saved in MongoDB whose Cloudinary original no longer exists, and
// restores those originals under the same public ID, so the stored URLs work again
// without anyone re-uploading.
//
//   npm run images:check                          report only
//   npm run images:restore                        report, then restore what can be restored
//   npm run images:restore -- --from ~/saved      also restore from files saved under the
//                                                 URL's file name (e.g. abc123.jpg)
//
// Why this is needed: admin forms used to delete an image before saving, and when
// the save then failed the record kept pointing at the deleted image. Cloudinary's
// CDN keeps serving a deleted original at its exact URL for a while, so the admin
// preview still looked fine, but every resized copy the storefront requests
// (/image/upload/w_640,.../) needs the original and fails with 404.
// The restore uses Cloudinary's backup when the account keeps one, otherwise the
// still-cached original (the CDN has several edges and not all of them keep it),
// otherwise a file from --from.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { IMAGE_FIELDS, publicIdFromUrl } = require('../utils/imageReferences');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const RESTORE = process.argv.includes('--restore');
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null;

// All values at a dotted path, flattening arrays on the way ("imageUrlEnglish.imageUrl").
const valuesAt = (doc, field) =>
  field.split('.').reduce((values, key) => values.flatMap((v) => (v == null ? [] : [].concat(v[key] ?? []))), [doc]);

const statusOf = (url) => fetch(url, { method: 'HEAD' }).then((r) => r.status, () => 0);
const resized = (url) => url.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_limit,w_200/');

const uploadBuffer = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ public_id: publicId, overwrite: false, resource_type: 'image' }, (e, r) => (e ? reject(e) : resolve(r)))
      .end(buffer);
  });

let backupAvailable = true;
const restoreFromBackup = async (publicId) => {
  if (!backupAvailable) return false;
  const result = await cloudinary.api.restore([publicId]).catch((e) => ({ [publicId]: { error: e.message || e } }));
  const ok = result[publicId] && !result[publicId].error;
  if (!ok) backupAvailable = false; // the account has no backups; don't ask again for every image
  return ok;
};

const restoreFromCdnCopy = async (publicId, url) => {
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) return false;
  await uploadBuffer(Buffer.from(await res.arrayBuffer()), publicId);
  return true;
};

const savedFile = (url) => {
  const file = FROM && path.join(FROM, path.basename(new URL(url).pathname));
  return file && fs.existsSync(file) ? file : null;
};

const restoreFromFile = async (publicId, url) => {
  const file = savedFile(url);
  if (!file) return false;
  await uploadBuffer(fs.readFileSync(file), publicId);
  return true;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const cloud = cloudinary.config().cloud_name;
  const assets = new Map(); // publicId -> { url, usedBy[] }
  const others = []; // URLs that are not in this Cloudinary account

  for (const [Model, paths] of IMAGE_FIELDS) {
    const docs = await Model.find({}, `${paths.join(' ')} nameEnglish titleEnglish name orderId`).lean();
    for (const doc of docs) {
      const label = `${Model.modelName} "${doc.nameEnglish || doc.titleEnglish || doc.name || doc.orderId || doc._id}"`;
      for (const field of paths) {
        for (const url of valuesAt(doc, field)) {
          if (typeof url !== 'string' || !url.trim()) continue;
          const publicId = url.includes(`res.cloudinary.com/${cloud}/`) ? publicIdFromUrl(url) : null;
          if (!publicId) {
            others.push({ url, label: `${label} ${field}` });
            continue;
          }
          if (!assets.has(publicId)) assets.set(publicId, { url, usedBy: [] });
          assets.get(publicId).usedBy.push(`${label} ${field}`);
        }
      }
    }
  }

  const ids = [...assets.keys()];
  const existing = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const { resources } = await cloudinary.api.resources_by_ids(ids.slice(i, i + 100), { max_results: 100 });
    resources.forEach((r) => existing.add(r.public_id));
  }
  const missing = ids.filter((id) => !existing.has(id));
  console.log(`${ids.length} Cloudinary images referenced, ${missing.length} missing from Cloudinary storage.`);

  let restored = 0;
  for (const publicId of missing) {
    const { url, usedBy } = assets.get(publicId);
    let outcome = (await statusOf(url)) === 200
      ? 'recoverable: the CDN still serves the original'
      : savedFile(url)
        ? `recoverable: ${savedFile(url)}`
        : 'no copy found: re-upload this image in the admin';
    if (RESTORE) {
      try {
        const how = (await restoreFromBackup(publicId))
          ? 'backup'
          : (await restoreFromCdnCopy(publicId, url))
            ? 'CDN copy'
            : (await restoreFromFile(publicId, url))
              ? 'saved file'
              : null;
        if (how) {
          restored++;
          outcome = `restored from ${how}; resized copy now -> HTTP ${await statusOf(resized(url))}`;
        }
      } catch (e) {
        outcome = `restore failed: ${e.message || JSON.stringify(e)}`;
      }
    }
    console.log(`- ${publicId}: ${outcome}\n    used by ${usedBy.join('; ')}`);
  }

  const broken = [];
  for (const { url, label } of others) {
    const status = /^https?:\/\//.test(url) ? await statusOf(url) : 'not an absolute URL';
    if (status !== 200) broken.push(`- ${url} (${status})\n    used by ${label}`);
  }
  console.log(`${others.length} images hosted elsewhere, ${broken.length} not loading.${broken.length ? `\n${broken.join('\n')}` : ''}`);
  if (RESTORE) console.log(`Restored ${restored} of ${missing.length}.`);
  else if (missing.length) console.log('Run with --restore to restore the recoverable ones.');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
