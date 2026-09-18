const Product = require('../model/productModel');
const ProductVariants = require('../model/productVariantsModel');
const Brand = require('../model/brandModel');
const Category = require('../model/categoryModel');
const Banner = require('../model/bannerModel');
const Country = require('../model/countryModel');
const Order = require('../model/orderModel');

// Every field that stores a Cloudinary image URL. A model that gains an image
// field must be listed here, or that image can be deleted while still in use.
const IMAGE_FIELDS = [
  [Product, ['imageUrlEnglish.imageUrl', 'imageUrlArabic.imageUrl']],
  [ProductVariants, ['imageUrlEnglish.imageUrl', 'imageUrlArabic.imageUrl']],
  [Brand, ['logoUrlEnglish', 'logoUrlArabic', 'brandImageEnglish', 'brandMobileImageEnglish', 'brandImageArabic', 'brandMobileImageArabic']],
  [Category, ['imageUrlEnglish', 'imageUrlArabic']],
  [Banner, ['imageUrlEnglish', 'imageMobileUrlEnglish', 'imageUrlArabic', 'imageMobileUrlArabic']],
  [Country, ['flagUrl']],
  // order snapshots keep showing the image after the product changes
  [Order, ['orderItem.productImageEnglish', 'orderItem.productImageArabic']],
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "luvana/abc" from https://res.cloudinary.com/<cloud>/image/upload/[<transformations>/][v123/]luvana/abc.jpg
const publicIdFromUrl = (url) => {
  const match = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(.+)$/i.exec(url || '');
  if (!match) return null;
  return match[1].replace(/^(?:.*?\/)?v\d+\//, '').replace(/\.[a-z0-9]+$/i, '');
};

// Records whose image fields still point at this Cloudinary image, as "Model id".
const findImageReferences = async (publicId, limit = 5) => {
  const pattern = new RegExp(`/${escapeRegex(publicId)}(\\.[A-Za-z0-9]+)?$`);
  const perModel = await Promise.all(
    IMAGE_FIELDS.map(([Model, paths]) =>
      Model.find({ $or: paths.map((path) => ({ [path]: pattern })) }, '_id')
        .limit(limit)
        .lean()
        .then((docs) => docs.map((doc) => `${Model.modelName} ${doc._id}`))
    )
  );
  return perModel.flat().slice(0, limit);
};

module.exports = { IMAGE_FIELDS, publicIdFromUrl, findImageReferences };
