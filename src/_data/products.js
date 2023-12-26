// @ts-check
require("dotenv").config();

const Airtable = require("airtable");
const { AssetCache } = require("@11ty/eleventy-fetch");
const Image = require("@11ty/eleventy-img");

const IMAGES_URL_PATH = "/images/";
const IMAGES_OUTPUT_DIR = `./_site${IMAGES_URL_PATH}`;

// I'm setting the cache to 2 hours to match with
// Airtable attachments URL expiry
// See FAQs on https://support.airtable.com/docs/airtable-attachment-url-behavior.
const CACHE_DURATION = "2h";

// Get API Key/Personal from environment
// For development, open .env.dev file
// and uncomment the first line
const apiKey = process.env.AIRTABLE_API_KEY;

async function getProductsData() {
  // Initialize Airtable API instance
  const base = new Airtable({ apiKey: apiKey }).base("appSQ71LR08FGNCK2");
  let records = [];
  try {
    // Get all the records from a view.
    // This is easier than getting data page wise
    records = await base("Products")
      .select({
        view: "Grid view",
        // You can add filter and sort options here
      })
      .all();
  } catch (e) {
    // Show error and return empty array on failures
    console.error(e);
    return [];
  }

  // Get only fields
  let fields = records.map((r) => {
    return r.fields;
  });

  // Pick URLs from Photos object array
  // I'm picking the URL to the full image, as this will be post processed
  // through Elevnty Image later in the pipeline
  fields = fields.map((f) => {
    const photos = f.Photos;
    return {
      ...f,
      Photos: photos?.map((p) => p?.url),
    };
  });

  // Remove entries with no title
  fields = fields.filter((f) => Boolean(f.Title));

  return fields;
}

async function processRemoteImages(products) {
  // Using Promise.all to wait until all product objects
  // are processed.
  return Promise.all(
    products.map(async (p) => {
      // Using Promise.all again to wait until all image URLs
      // are processed.
      const photos = await Promise.all(
        p.Photos.map(async (url) => {
          const metadata = await Image(url, {
            widths: [800, 600, 400],
            urlPath: IMAGES_URL_PATH,
            outputDir: IMAGES_OUTPUT_DIR,
            formats: ["webp", "jpeg"],
            cacheOptions: {
              duration: CACHE_DURATION,
            },
          });

          // Here you could return metadata object and manually
          // populate <img> or <picture> elements in Nunjucks template.
          // But, I'm taking a shortcut by generating <picture> element using
          // Elevent Image's generateHTML utility function
          return Image.generateHTML(metadata, {
            alt: `Thumbnail for ${p.Title}`,

            // Once, you finalise the design of the page,
            // Use https://ausi.github.io/respimagelint/
            // to determine optimum 'sizes' attribute
            sizes: "100w",
          });
        }),
      );

      return {
        ...p,
        Photos: photos,
      };
    }),
  );
}

module.exports = async function () {
  const productsCache = new AssetCache("airtable-products");

  if (productsCache.isCacheValid(CACHE_DURATION)) {
    return productsCache.getCachedValue(); // This returns a promise
  }

  console.log("Cache expired. Fetching data from Airtable");

  let products = await getProductsData();

  products = await processRemoteImages(products);

  await productsCache.save(products, "json");

  return products;
};
