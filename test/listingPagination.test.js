// Run with: npm test  (node:test, no database needed)
//
// Regression test for products that existed but never appeared on any page of
// the admin listing. `sort({ createdAt: -1 })` is not a total order while 25
// products share a missing createdAt, so MongoDB was free to return those ties
// in a different order for every page request. skip/limit over that returned
// some products twice and hid others from every page. Search hid the bug
// because it narrowed the result set to a single page, where skip is 0.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Pages a list the way skip/limit does. `engineOrder` stands in for MongoDB's
// freedom to return equally-ranked documents in any order it likes, which it
// may re-decide on each of the per-page queries.
const walkPages = (docs, sortKeys, limit, engineOrder) => {
  const compare = (a, b) => {
    for (const key of sortKeys) {
      if (a[key] === b[key]) continue;
      // Missing sorts lowest, as it does in MongoDB.
      if (a[key] === undefined) return 1;
      if (b[key] === undefined) return -1;
      return a[key] < b[key] ? 1 : -1; // descending
    }
    return 0;
  };

  const seen = new Map();
  for (let page = 1; page <= Math.ceil(docs.length / limit); page++) {
    const sorted = engineOrder(docs, page).slice().sort(compare);
    for (const doc of sorted.slice((page - 1) * limit, page * limit)) {
      seen.set(doc._id, (seen.get(doc._id) || 0) + 1);
    }
  }
  return seen;
};

const stableOrder = (docs) => docs;
// Ties come back rotated by a different amount on each page's query.
const arbitraryOrder = (docs, page) => docs.slice(page * 3).concat(docs.slice(0, page * 3));

// 4 products carry a createdAt; the rest are legacy rows that never got one.
const products = [
  { _id: 'p01', createdAt: '2026-02-21T07:33:37.827Z' },
  { _id: 'p02', createdAt: '2026-02-21T07:33:37.827Z' },
  { _id: 'p03', createdAt: '2026-01-04T10:00:00.000Z' },
  { _id: 'p04', createdAt: '2025-12-30T09:00:00.000Z' },
  ...Array.from({ length: 21 }, (_, i) => ({ _id: `legacy${String(i).padStart(2, '0')}` }))
];

test('sorting on createdAt alone hides products from every page', () => {
  const seen = walkPages(products, ['createdAt'], 10, arbitraryOrder);
  assert.ok(seen.size < products.length, 'expected the unstable sort to lose products');
  assert.ok([...seen.values()].some((n) => n > 1), 'expected the unstable sort to repeat products');
});

test('tiebreaking on _id returns every product exactly once, at any page size', () => {
  for (const limit of [1, 3, 10, 25, 50]) {
    for (const order of [stableOrder, arbitraryOrder]) {
      const seen = walkPages(products, ['createdAt', '_id'], limit, order);
      assert.equal(seen.size, products.length, `limit ${limit}: ${products.length - seen.size} products hidden`);
      assert.deepEqual([...new Set(seen.values())], [1], `limit ${limit}: a product came back on two pages`);
    }
  }
});

// Guards the fix itself: a paginated query whose sort does not end in a unique
// field can hide rows again, however the sort field is chosen.
test('every paginated controller query tiebreaks its sort on _id', () => {
  const controllers = path.join(__dirname, '..', 'controller');
  const files = fs.readdirSync(controllers, { recursive: true })
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(controllers, f));

  const paginated = files.filter((f) => fs.readFileSync(f, 'utf8').includes('.skip('));
  assert.ok(paginated.length >= 4, 'expected to find the paginated listings');

  for (const file of paginated) {
    const source = fs.readFileSync(file, 'utf8');
    const sorts = source.match(/\.sort\((?:\{[^}]*\}|\w+)\)/g) || [];
    assert.ok(sorts.length > 0, `${path.basename(file)} paginates without sorting`);
    for (const sort of sorts) {
      const literal = sort.startsWith('.sort({');
      // A sort object built up in a variable must set _id somewhere in the file.
      const tiebroken = literal ? /_id/.test(sort) : /\b\w+\._id\s*=/.test(source);
      assert.ok(tiebroken, `${path.basename(file)}: ${sort} has no _id tiebreaker`);
    }
  }
});
