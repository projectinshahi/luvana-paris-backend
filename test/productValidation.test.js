// Run with: npm test  (node:test, no database needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCreateProduct, validateUpdateProduct } = require('../controller/admin/productController');

const id = 'a'.repeat(24);
const image = { imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/luvana/x.jpg', publicId: 'luvana/x' };
const section = (extra = {}) => ({ titleEnglish: 'Ingredients', descriptionEnglish: [{ description: 'Water' }], ...extra });
const variant = (extra = {}) => ({ color: '#8b5e3c', price: 12.5, mrp: 15, stock: 3, imageUrlEnglish: [image], imageUrlArabic: [image], ...extra });
// Everything the create form asks for. Individual tests blank out one field.
const product = (extra = {}) => ({
  category: id, brand: id, nameEnglish: 'Serum', nameArabic: 'سيروم',
  shortDescriptionEnglish: 'A serum', shortDescriptionArabic: 'سيروم',
  description: [section()], variant: variant(), ...extra
});
const without = (key, extra = {}) => { const p = product(extra); delete p[key]; return p; };
const errorsOf = (r) => Object.keys((r.error && r.error.errors) || {}).sort();
const messageOf = (r, path) => r.error && r.error.errors[path];

test('a complete create passes, with numeric strings coerced and unknown keys dropped', () => {
  const r = validateCreateProduct(product({ variant: variant({ price: '12.5', stock: '3' }), __v: 9, createdAt: 'x' }));
  assert.equal(r.error, undefined);
  assert.equal(r.data.variant.price, 12.5);
  assert.equal(r.data.variant.stock, 3);
  assert.equal('__v' in r.data, false);
  assert.equal('createdAt' in r.data, false);
});

test('an empty create reports every required field at once', () => {
  assert.deepEqual(errorsOf(validateCreateProduct({})), [
    'brand', 'category', 'description', 'nameArabic', 'nameEnglish',
    'shortDescriptionArabic', 'shortDescriptionEnglish', 'variants'
  ]);
});

test('each basic information field is required on create', () => {
  for (const field of ['category', 'brand', 'nameEnglish', 'nameArabic', 'shortDescriptionEnglish', 'shortDescriptionArabic']) {
    assert.deepEqual(errorsOf(validateCreateProduct(without(field))), [field], `missing ${field}`);
    assert.deepEqual(errorsOf(validateCreateProduct(product({ [field]: '   ' }))), [field], `blank ${field}`);
  }
});

test('at least one description section is required on create', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(without('description'))), ['description']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [] }))), ['description']);
  assert.equal(messageOf(validateCreateProduct(product({ description: [] })), 'description'), 'Add at least one description section');
});

test('every product details field is required on create', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(without('variant'))), ['variants']);
  for (const [field, bad] of [['color', undefined], ['color', ''], ['color', 'red'], ['price', undefined], ['mrp', undefined], ['stock', undefined]]) {
    const v = variant(); v[field] = bad;
    if (bad === undefined) delete v[field];
    assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: v }))), [`variant.${field}`], `${field}=${bad}`);
  }
});

test('both English and Arabic images are required on create, and each is capped at 10', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ imageUrlEnglish: [] }) }))), ['variant.imageUrlEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ imageUrlArabic: [] }) }))), ['variant.imageUrlArabic']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ imageUrlEnglish: [], imageUrlArabic: [] }) }))),
    ['variant.imageUrlArabic', 'variant.imageUrlEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ imageUrlEnglish: Array(11).fill(image) }) }))), ['variant.imageUrlEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ imageUrlArabic: Array(11).fill(image) }) }))), ['variant.imageUrlArabic']);
});

test('prices and stock reject inappropriate values', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ price: 0 }) }))), ['variant.price']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ price: -5 }) }))), ['variant.price']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ mrp: -1 }) }))), ['variant.mrp']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ stock: -1 }) }))), ['variant.stock']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ stock: 1.5 }) }))), ['variant.stock']);
  // An empty stock field must not read as "0 in stock".
  assert.deepEqual(errorsOf(validateCreateProduct(product({ variant: variant({ stock: '' }) }))), ['variant.stock']);
  assert.equal(messageOf(validateCreateProduct(product({ variant: variant({ price: 20 }) })), 'variant.price'),
    'Selling price cannot be higher than the actual price');
});

// A variant carries the same fields as a single-item product's details, plus its
// own name so the storefront can label the choice.
const namedVariant = (extra = {}) => variant({ nameEnglish: 'Red', nameArabic: 'أحمر', ...extra });
const multi = (variants, extra = {}) => without('variant', { hasVariants: true, variants, ...extra });

test('a multi-variant product takes variants instead of its own product details', () => {
  const r = validateCreateProduct(multi([namedVariant()]));
  assert.equal(r.error, undefined);
  assert.equal(r.data.variants.length, 1);
  assert.equal(r.data.variants[0].nameEnglish, 'Red');
  assert.equal(r.data.variant, undefined);
  assert.equal(validateCreateProduct(multi([namedVariant(), namedVariant({ nameEnglish: 'Blue', color: '#0000ff' })])).data.variants.length, 2);
  assert.equal(validateCreateProduct(product({ hasVariant: 'true', variants: [namedVariant()] })).data.hasVariants, true);
});

test('a multi-variant product needs at least one variant', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(multi(undefined))), ['variants']);
  assert.deepEqual(errorsOf(validateCreateProduct(multi([]))), ['variants']);
  assert.equal(messageOf(validateCreateProduct(multi([])), 'variants'), 'Add at least one variant');
  assert.deepEqual(errorsOf(validateCreateProduct(multi(Array(21).fill(namedVariant())))), ['variants']);
  // ...and the rest of the form is still required.
  assert.deepEqual(errorsOf(validateCreateProduct({ hasVariants: true })), [
    'brand', 'category', 'description', 'nameArabic', 'nameEnglish',
    'shortDescriptionArabic', 'shortDescriptionEnglish', 'variants'
  ]);
});

test('every variant is validated, and errors name the variant that failed', () => {
  // The second variant reports under its own index, so the form highlights the right row.
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant(), namedVariant({ price: 0 })]))), ['variants.1.price']);
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant(), namedVariant({ stock: -1 })]))), ['variants.1.stock']);
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ imageUrlEnglish: [] })]))), ['variants.0.imageUrlEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ imageUrlArabic: [] })]))), ['variants.0.imageUrlArabic']);
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ color: '' })]))), ['variants.0.color']);
  // Each variant gets its own price comparison.
  assert.equal(messageOf(validateCreateProduct(multi([namedVariant(), namedVariant({ price: 99 })])), 'variants.1.price'),
    'Selling price cannot be higher than the actual price');
  // A broken actual price points at itself, not at the selling price.
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ mrp: -1 })]))), ['variants.0.mrp']);
  // Several bad variants all report at once.
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ price: 0 }), namedVariant({ stock: -1 })]))),
    ['variants.0.price', 'variants.1.stock']);
});

// A section is optional on edit, but one that was added must say something —
// an empty section is stored and then renders as a blank block on the storefront.
test('a section that was added needs a title and at least one description line', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [section({ titleEnglish: '' })] }))),
    ['description.0.titleEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [section({ descriptionEnglish: [] })] }))),
    ['description.0.descriptionEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [section({ descriptionEnglish: [{ description: '  ' }] })] }))),
    ['description.0.descriptionEnglish.0.description']);
  // The form's blank starting section reports both, each under its own input.
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [
    { titleEnglish: '', titleArabic: '', descriptionEnglish: [{ description: '' }], descriptionArabic: [{ description: '' }] }
  ] }))), ['description.0.descriptionEnglish.0.description', 'description.0.titleEnglish']);
  // Arabic stays optional inside a section, and a blank Arabic line is accepted.
  assert.equal(validateCreateProduct(product({ description: [section({ titleArabic: 'المكونات', descriptionArabic: [{ description: '' }] })] })).error, undefined);
});

test('description sections and lines are capped, and the error names the offending one', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: Array(21).fill(section()) }))), ['description']);
  assert.equal(validateCreateProduct(product({ description: Array(20).fill(section()) })).error, undefined);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [section({ descriptionEnglish: Array(51).fill({ description: 'x' }) })] }))),
    ['description.0.descriptionEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [section({ titleEnglish: 'x'.repeat(201) })] }))),
    ['description.0.titleEnglish']);
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [section({ descriptionEnglish: [{ description: 'x'.repeat(1001) }] })] }))),
    ['description.0.descriptionEnglish.0.description']);
});

test('the second section reports under its own index, so the form highlights the right input', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(product({ description: [section(), section({ titleEnglish: '' })] }))),
    ['description.1.titleEnglish']);
});

test('updates accept any subset, including populated references from older clients', () => {
  assert.equal(validateUpdateProduct({ status: 'inactive' }).error, undefined);
  assert.equal(validateUpdateProduct({ category: { _id: id, nameEnglish: 'Skin' } }).data.category, id);
  assert.deepEqual(errorsOf(validateUpdateProduct({ nameEnglish: '   ' })), ['nameEnglish']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ status: 'deleted' })), ['status']);
});

// The create form's stricter rules must not lock existing products out of editing:
// most of them predate those fields being asked for.
test('editing keeps the looser rules so saved products stay editable', () => {
  assert.equal(validateUpdateProduct({ shortDescriptionEnglish: '', shortDescriptionArabic: '' }).error, undefined);
  assert.equal(validateUpdateProduct({ description: [] }).error, undefined);
  const noColourNoArabic = { price: 12.5, mrp: 15, stock: 3, imageUrlEnglish: [image] };
  assert.equal(validateUpdateProduct({ variant: noColourNoArabic }).error, undefined);
  // The rules that always applied still do on edit.
  assert.deepEqual(errorsOf(validateUpdateProduct({ variant: { ...noColourNoArabic, price: -1 } })), ['variant.price']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ variant: { ...noColourNoArabic, imageUrlEnglish: [] } })), ['variant.imageUrlEnglish']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ description: [section({ titleEnglish: '' })] })), ['description.0.titleEnglish']);
});

// Editing a multi-variant product sends the whole list back, under looser rules
// than create: variants saved earlier may hold a CSS colour name or no Arabic
// images, and requiring either would lock those products out of editing.
test('editing accepts the whole variant list, including saved shapes create would refuse', () => {
  const saved = (extra = {}) => namedVariant({ _id: id, ...extra });
  assert.equal(validateUpdateProduct({ hasVariants: true, variants: [saved()] }).error, undefined);
  // a colour name rather than a hex value
  assert.equal(validateUpdateProduct({ hasVariants: true, variants: [saved({ color: 'Red' })] }).error, undefined);
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ color: 'Red' })]))), ['variants.0.color']);
  // no Arabic images
  assert.equal(validateUpdateProduct({ hasVariants: true, variants: [saved({ imageUrlArabic: [] })] }).error, undefined);
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ imageUrlArabic: [] })]))), ['variants.0.imageUrlArabic']);
  // no colour at all
  const noColour = saved(); delete noColour.color;
  assert.equal(validateUpdateProduct({ hasVariants: true, variants: [noColour] }).error, undefined);
});

test('editing still rejects variants that are genuinely broken', () => {
  const saved = (extra = {}) => namedVariant({ _id: id, ...extra });
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: [] })), ['variants']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: [saved({ price: 0 })] })), ['variants.0.price']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: [saved({ stock: -1 })] })), ['variants.0.stock']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: [saved({ stock: '' })] })), ['variants.0.stock']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: [saved({ imageUrlEnglish: [] })] })), ['variants.0.imageUrlEnglish']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: [saved(), saved({ price: 99 })] })), ['variants.1.price']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: [saved({ _id: 'nope' })] })), ['variants.0._id']);
  assert.deepEqual(errorsOf(validateUpdateProduct({ hasVariants: true, variants: Array(21).fill(saved()) })), ['variants']);
});

test('a variant without an id is a new one, and the single-variant edit path is untouched', () => {
  const fresh = namedVariant();               // no _id: created on save
  const r = validateUpdateProduct({ hasVariants: true, variants: [namedVariant({ _id: id }), fresh] });
  assert.equal(r.error, undefined);
  assert.equal(r.data.variants[0]._id, id);
  assert.equal(r.data.variants[1]._id, undefined);
  // editing a single-item product still goes through `variant`, unchanged
  assert.equal(validateUpdateProduct({ variant: { _id: id, price: 5, mrp: 6, stock: 1, imageUrlEnglish: [image] } }).error, undefined);
});

// The "Has Variants" checkbox is gone: the admin adds variants with a button and
// the stored flag follows the count, so one variant is a product sold as a single
// item and several is a product sold in choices.
test('a product needs at least one variant, in either shape', () => {
  assert.deepEqual(errorsOf(validateCreateProduct(without('variant'))), ['variants']);
  assert.deepEqual(errorsOf(validateCreateProduct(without('variant', { variants: [] }))), ['variants']);
  assert.equal(messageOf(validateCreateProduct(without('variant', { variants: [] })), 'variants'), 'Add at least one variant');
  // one variant is enough, and needs no name of its own
  const one = validateCreateProduct(without('variant', { variants: [variant()] }));
  assert.equal(one.error, undefined);
  assert.equal(one.data.variants.length, 1);
  assert.equal(one.data.variants[0].nameEnglish, undefined);
  // the legacy singular shape still saves, so older clients keep working
  assert.equal(validateCreateProduct(product()).error, undefined);
});

test('a variant name is optional and only labels a choice', () => {
  const blank = validateCreateProduct(without('variant', { variants: [variant({ nameEnglish: '', nameArabic: '' })] }));
  assert.equal(blank.error, undefined);
  const named = validateCreateProduct(without('variant', { variants: [namedVariant()] }));
  assert.equal(named.data.variants[0].nameEnglish, 'Red');
  // still capped
  assert.deepEqual(errorsOf(validateCreateProduct(multi([namedVariant({ nameEnglish: 'x'.repeat(201) })]))),
    ['variants.0.nameEnglish']);
  // and optional on edit too
  assert.equal(validateUpdateProduct({ variants: [{ _id: id, ...variant() }] }).error, undefined);
});
