const { z } = require('zod');
const Product = require('../../model/productModel');
const ProductVariants = require('../../model/productVariantsModel');
const Category = require('../../model/categoryModel');
const Brand = require('../../model/brandModel');

const parseBoolean = (value, defaultValue = undefined) => {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return Boolean(value);
};

const BRAND_FIELDS = 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic';

// ---------- validation ----------
// Every write is validated before anything is saved, and failures come back as
// { message, errors: { "<field path>": "<message>" } } so the admin form can show
// each message next to its field. Unknown keys (_id, __v, timestamps, populated
// objects...) are dropped rather than written straight into the document.

const objectId = (message) => z.preprocess(
  // older clients send the populated { _id, nameEnglish } object instead of the id
  (v) => (v && typeof v === 'object' && v._id ? String(v._id) : v),
  z.string({ error: message }).regex(/^[a-f\d]{24}$/i, message)
);
const numberish = (schema) => z.preprocess(
  (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
  schema
);
const booleanish = z.preprocess((v) => parseBoolean(v), z.boolean());
const text = (max, label) => z.string().trim().max(max, `${label} must be ${max} characters or fewer`);
const requiredText = (max, message, label) => z.string({ error: message }).trim().min(1, message).max(max, `${label} must be ${max} characters or fewer`);

const imageSchema = z.object({
  imageUrl: z.string().url('Image URL is invalid'),
  publicId: z.string().optional()
});

// Description sections are optional, but a section that was added has to say
// something: an empty one is stored and then renders as a blank block on the
// storefront. Arabic stays optional here, as it was.
const descriptionSectionSchema = z.object({
  titleEnglish: requiredText(200, 'Enter the section title', 'Section title'),
  titleArabic: text(200, 'Section title').optional(),
  descriptionEnglish: z.array(z.object({
    description: requiredText(1000, 'Enter the description or remove this line', 'Description')
  })).min(1, 'Add at least one description line').max(50, 'Use 50 description lines or fewer'),
  descriptionArabic: z.array(z.object({ description: text(1000, 'Description') })).max(50, 'Use 50 description lines or fewer').optional()
});

const productFields = {
  category: objectId('Select a category'),
  brand: objectId('Select a brand'),
  nameEnglish: requiredText(200, 'Enter the product name', 'Product name'),
  nameArabic: requiredText(200, 'Enter the Arabic product name', 'Arabic product name'),
  shortDescriptionEnglish: text(500, 'Short description'),
  shortDescriptionArabic: text(500, 'Short description'),
  description: z.array(descriptionSectionSchema).max(20, 'Use 20 description sections or fewer'),
  isNew: booleanish,
  isFeatured: booleanish,
  hasVariants: booleanish,
  status: z.enum(['active', 'inactive'])
};

// The price, stock and images of a product sold as a single item (hasVariants: false).
const variantFields = {
  _id: objectId('Invalid variant').optional(),
  color: z.string({ error: 'Pick a colour' }).regex(/^#[0-9a-f]{6}$/i, 'Pick a colour'),
  price: numberish(z.number({ error: 'Enter the selling price' }).positive('Selling price must be more than 0')),
  mrp: numberish(z.number({ error: 'Enter the actual price' }).positive('Actual price must be more than 0')),
  stock: numberish(z.number({ error: 'Enter the stock quantity' }).int('Stock must be a whole number').min(0, 'Stock cannot be negative')),
  imageUrlEnglish: z.array(imageSchema).min(1, 'Add at least one English product image').max(10, 'Use 10 images or fewer'),
  imageUrlArabic: z.array(imageSchema).max(10, 'Use 10 images or fewer')
};

// Editing keeps the looser rules: products saved before the create form asked for
// a colour and Arabic images must stay editable without back-filling them.
const defaultVariantSchema = z.object({
  ...variantFields,
  color: variantFields.color.optional(),
  imageUrlArabic: variantFields.imageUrlArabic.optional()
});

// Creating asks for every field on the form, so none of them may be left blank.
const createVariantSchema = z.object({
  ...variantFields,
  imageUrlArabic: variantFields.imageUrlArabic.min(1, 'Add at least one Arabic product image')
});

// A product sold in several variants: each one is the same block of fields plus
// its own name, so the storefront can label the choice.
const createVariantsSchema = z.array(
  createVariantSchema.extend({
    nameEnglish: requiredText(200, 'Enter the variant name', 'Variant name'),
    nameArabic: requiredText(200, 'Enter the Arabic variant name', 'Arabic variant name')
  })
).min(1, 'Add at least one variant').max(20, 'Use 20 variants or fewer');

const createProductSchema = z.object({
  ...productFields,
  shortDescriptionEnglish: requiredText(500, 'Enter the short description', 'Short description'),
  shortDescriptionArabic: requiredText(500, 'Enter the Arabic short description', 'Short description'),
  description: productFields.description.min(1, 'Add at least one description section'),
  isNew: productFields.isNew.optional(),
  isFeatured: productFields.isFeatured.optional(),
  hasVariants: productFields.hasVariants.optional(),
  status: productFields.status.optional(),
  variant: createVariantSchema.optional(),
  variants: createVariantsSchema.optional()
});

// Updates may send any subset of the fields.
const updateProductSchema = z.object({
  ...Object.fromEntries(Object.entries(productFields).map(([k, v]) => [k, v.optional()])),
  variant: defaultVariantSchema.optional()
});

// Clients before this change sent `hasVariant` (singular), which was silently ignored.
const normalizeBody = (body) => {
  const b = { ...(body || {}) };
  if (b.hasVariants === undefined && b.hasVariant !== undefined) b.hasVariants = b.hasVariant;
  return b;
};

// Compared after parsing, and only when both prices are valid on their own:
// saying "higher than the actual price" while the actual price is itself
// rejected points at the wrong field. The admin form applies the same rule.
const priceIssues = (body, issues) => {
  const failed = new Set(issues.map((i) => i.path.join('.')));
  const at = (...path) => {
    const prefix = path.join('.');
    if (failed.has(`${prefix}.price`) || failed.has(`${prefix}.mrp`)) return [];
    const variant = path.reduce((node, key) => node?.[key], body);
    return variant && Number(variant.price) > Number(variant.mrp)
      ? [{ path: [...path, 'price'], message: 'Selling price cannot be higher than the actual price' }]
      : [];
  };
  return [
    ...at('variant'),
    ...(Array.isArray(body?.variants) ? body.variants.flatMap((_, i) => at('variants', String(i))) : [])
  ];
};

const validationFailure = (issues) => {
  const errors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { message: 'Please correct the highlighted fields.', errors };
};

// Returns { data } or { error } (the 400 body).
const validateCreateProduct = (rawBody) => {
  const body = normalizeBody(rawBody);
  const parsed = createProductSchema.safeParse(body);
  const issues = parsed.success ? [] : [...parsed.error.issues];
  // Checked here rather than in the schema so it is reported together with any
  // field errors (zod skips object-level refinements while a field is invalid).
  const multi = parseBoolean(body.hasVariants, false);
  if (!multi && !body.variant) {
    issues.push({ path: ['variant'], message: 'Add the price, stock and at least one image' });
  }
  if (multi && !body.variants) {
    issues.push({ path: ['variants'], message: 'Add at least one variant' });
  }
  issues.push(...priceIssues(body, issues));
  return issues.length ? { error: validationFailure(issues) } : { data: parsed.data };
};

const validateUpdateProduct = (rawBody) => {
  const body = normalizeBody(rawBody);
  const parsed = updateProductSchema.safeParse(body);
  const issues = parsed.success ? [] : [...parsed.error.issues];
  issues.push(...priceIssues(body, issues));
  return issues.length ? { error: validationFailure(issues) } : { data: parsed.data };
};

// Referenced category and brand must exist.
const checkReferences = async ({ category, brand }) => {
  const [hasCategory, hasBrand] = await Promise.all([
    category ? Category.exists({ _id: category }) : true,
    brand ? Brand.exists({ _id: brand }) : true
  ]);
  const errors = {};
  if (!hasCategory) errors.category = 'This category no longer exists';
  if (!hasBrand) errors.brand = 'This brand no longer exists';
  return Object.keys(errors).length ? { message: 'Please correct the highlighted fields.', errors } : null;
};

const variantDocument = (product, variant) => ({
  product: product._id,
  nameEnglish: variant.nameEnglish || product.nameEnglish,
  nameArabic: variant.nameArabic || product.nameArabic,
  color: variant.color,
  stock: variant.stock,
  price: variant.price,
  mrp: variant.mrp,
  imageUrlEnglish: variant.imageUrlEnglish,
  imageUrlArabic: variant.imageUrlArabic || [],
  status: 'active'
});

const findPopulated = (id) => Product.findById(id)
  .populate('category', 'nameEnglish nameArabic')
  .populate('brand', BRAND_FIELDS);

// Get all products with filters
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, category, brand } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const query = {};

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { nameEnglish: searchRegex },
        { nameArabic: searchRegex }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Brand filter
    if (brand) {
      query.brand = brand;
    }

    const totalItems = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const products = await Product.find(query)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic')
      // _id breaks ties so the sort is a total order. Without it, the 25 legacy
      // products that share createdAt: null order arbitrarily per query, and
      // skip/limit then returns some twice and hides others from every page.
      .sort({ createdAt: -1, _id: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.json({
      items: products,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate('category', 'nameEnglish nameArabic')
      .populate('brand', 'nameEnglish nameArabic logoUrlEnglish logoUrlArabic brandImageEnglish brandImageArabic');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new product — and, for a product sold as a single item, its price/stock/images
// variant in the same request, so a failure can no longer leave a product without them.
const createProduct = async (req, res) => {
  try {
    const { data, error } = validateCreateProduct(req.body);
    if (error) return res.status(400).json(error);
    const { variant, variants, ...fields } = data;

    const referenceError = await checkReferences(fields);
    if (referenceError) return res.status(400).json(referenceError);

    const product = await Product.create({
      category: fields.category,
      brand: fields.brand,
      nameEnglish: fields.nameEnglish,
      nameArabic: fields.nameArabic,
      shortDescriptionEnglish: fields.shortDescriptionEnglish || '',
      shortDescriptionArabic: fields.shortDescriptionArabic || '',
      description: fields.description || [],
      isNew: fields.isNew ?? false,
      isFeatured: fields.isFeatured ?? false,
      hasVariants: fields.hasVariants ?? false,
      status: fields.status || 'active'
    });

    // Both shapes are saved with the product rather than after it, so a failure
    // cannot leave a product with no price, images or variants to sell.
    const submitted = product.hasVariants ? variants : [variant];
    let savedVariants = [];
    try {
      savedVariants = await ProductVariants.insertMany(submitted.map((v) => variantDocument(product, v)));
    } catch (error) {
      // ponytail: several writes with a compensating delete, not a transaction; switch to
      // a session transaction if a crash between the writes ever needs to be covered.
      await ProductVariants.deleteMany({ product: product._id });
      await Product.deleteOne({ _id: product._id });
      throw error;
    }

    const populatedProduct = await findPopulated(product._id);
    res.status(201).json({
      ...populatedProduct.toObject(),
      // `variant` is what a single-item product has always answered with; `variants`
      // is the full list either way, so one field covers both shapes.
      variant: product.hasVariants ? null : savedVariants[0] || null,
      variants: savedVariants
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'The product could not be saved. Please try again.' });
  }
};

// Update product (any subset of fields) and, for a single-item product, its variant.
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { data, error } = validateUpdateProduct(req.body);
    if (error) return res.status(400).json(error);
    const { variant, ...updates } = data;

    const referenceError = await checkReferences(updates);
    if (referenceError) return res.status(400).json(referenceError);

    const existing = await Product.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const hasVariants = updates.hasVariants ?? existing.hasVariants;
    const updatesVariant = variant && !hasVariants;
    if (updatesVariant && variant._id && !(await ProductVariants.exists({ _id: variant._id, product: existing._id }))) {
      return res.status(400).json(validationFailure([{ path: ['variant'], message: 'This variant does not belong to the product' }]));
    }

    await Product.updateOne({ _id: id }, updates, { runValidators: true });
    const updatedProduct = await findPopulated(id);

    let savedVariant = null;
    if (updatesVariant) {
      const doc = variantDocument(updatedProduct, variant);
      savedVariant = variant._id
        ? await ProductVariants.findByIdAndUpdate(variant._id, doc, { new: true, runValidators: true })
        : await ProductVariants.create(doc);
    }

    res.json({ ...updatedProduct.toObject(), variant: savedVariant });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'The product could not be updated. Please try again.' });
  }
};

// Delete product (soft delete by setting status to inactive)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndUpdate(id, { status: 'inactive' }, { new: true });
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};