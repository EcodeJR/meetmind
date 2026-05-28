require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

(async () => {
  try {
    const usage = await cloudinary.api.usage();
    console.log('USAGE_RAW:', JSON.stringify(usage, null, 2));
  } catch (err) {
    console.error('USAGE_ERROR:', err && err.message ? err.message : err);
    if (err && err.http_code) console.error('HTTP_CODE:', err.http_code);
    process.exit(1);
  }
})();
