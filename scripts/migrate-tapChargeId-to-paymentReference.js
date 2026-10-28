/**
 * Migration: tapChargeId → paymentReference
 *
 * SAFETY RULES — read before running:
 *  1. Take a full MongoDB backup first (mongodump or Atlas snapshot).
 *  2. Run in DRY RUN mode (default) to preview counts — nothing is written.
 *  3. Run against staging and verify before touching production.
 *  4. The script is idempotent: re-running it is safe.
 *  5. Do NOT drop tapChargeId or its index until all app servers use paymentReference.
 *
 * Usage:
 *   node scripts/migrate-tapChargeId-to-paymentReference.js          # dry run
 *   node scripts/migrate-tapChargeId-to-paymentReference.js --write  # apply
 *   node scripts/migrate-tapChargeId-to-paymentReference.js --verify # post-run check
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--write');
const VERIFY  =  process.argv.includes('--verify');

const MONGO_URI = process.env.MONGODB_URL || process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGODB_URL not set. Aborting.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const orders = db.collection('orders');

  // ── Counts ──────────────────────────────────────────────────────────────────
  const total        = await orders.countDocuments();
  const hasTapId     = await orders.countDocuments({ tapChargeId: { $exists: true, $ne: null } });
  const hasPayRef    = await orders.countDocuments({ paymentReference: { $exists: true, $ne: null } });
  const needsCopy    = await orders.countDocuments({
    tapChargeId:       { $exists: true, $ne: null },
    paymentReference:  { $exists: false },
  });

  console.log('\n── Luvana Paris: tapChargeId → paymentReference migration ──');
  console.log(`Mode       : ${DRY_RUN ? 'DRY RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`Total docs : ${total}`);
  console.log(`Has tapChargeId (legacy)  : ${hasTapId}`);
  console.log(`Has paymentReference      : ${hasPayRef}`);
  console.log(`Needs copy                : ${needsCopy}`);

  if (VERIFY) {
    const bothSet = await orders.countDocuments({
      tapChargeId:      { $exists: true, $ne: null },
      paymentReference: { $exists: true, $ne: null },
    });
    const mismatch = [];
    const cursor = orders.find({
      tapChargeId:      { $exists: true, $ne: null },
      paymentReference: { $exists: true, $ne: null },
    }, { projection: { _id: 1, tapChargeId: 1, paymentReference: 1 } });
    for await (const doc of cursor) {
      if (doc.tapChargeId !== doc.paymentReference) {
        mismatch.push(doc._id.toString());
      }
    }
    console.log(`\nVerification:`);
    console.log(`  Orders with both fields set : ${bothSet}`);
    console.log(`  Value mismatches            : ${mismatch.length}`);
    if (mismatch.length > 0) {
      console.warn('  MISMATCH IDs:', mismatch);
    } else {
      console.log('  All values match. ✓');
    }
    await mongoose.disconnect();
    return;
  }

  if (needsCopy === 0) {
    console.log('\nNothing to do — all orders already have paymentReference set.');
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN: would copy tapChargeId → paymentReference for ${needsCopy} order(s).`);
    console.log('Re-run with --write to apply.');
    await mongoose.disconnect();
    return;
  }

  // ── Step 1: create the new index if it doesn't exist ──────────────────────
  const indexes = await orders.indexes();
  const hasPayRefIndex = indexes.some(ix => ix.key && ix.key.paymentReference !== undefined);
  if (!hasPayRefIndex) {
    console.log('\nCreating paymentReference index (unique, sparse)...');
    await orders.createIndex({ paymentReference: 1 }, { unique: true, sparse: true });
    console.log('Index created. ✓');
  } else {
    console.log('\npaymentReference index already exists. ✓');
  }

  // ── Step 2: copy tapChargeId → paymentReference for all orders that have it
  //            but not yet a paymentReference value ─────────────────────────
  console.log(`\nCopying tapChargeId → paymentReference for ${needsCopy} order(s)...`);
  const result = await orders.updateMany(
    { tapChargeId: { $exists: true, $ne: null }, paymentReference: { $exists: false } },
    [{ $set: { paymentReference: '$tapChargeId' } }]
  );
  console.log(`Updated: ${result.modifiedCount} document(s). ✓`);

  // ── Step 3: verify ────────────────────────────────────────────────────────
  const remaining = await orders.countDocuments({
    tapChargeId:      { $exists: true, $ne: null },
    paymentReference: { $exists: false },
  });
  if (remaining > 0) {
    console.warn(`WARNING: ${remaining} orders still missing paymentReference after migration.`);
  } else {
    console.log('All orders now have paymentReference. ✓');
  }

  console.log('\nNext steps (after verifying with --verify):');
  console.log('  1. Deploy the updated application code.');
  console.log('  2. Monitor for 30 days to confirm no Tap webhooks reference old orders.');
  console.log('  3. Drop the tapChargeId field: db.orders.updateMany({}, { $unset: { tapChargeId: "" } })');
  console.log('  4. Drop the legacy index: db.orders.dropIndex("tapChargeId_1")');
  console.log('  5. Remove the tapChargeId field from orderModel.js and the compatibility $or queries.');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
