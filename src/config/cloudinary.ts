// src/config/cloudinary.ts
// ─────────────────────────────────────────────
// Initialises the Cloudinary SDK.
// Your server uses this to generate signed upload
// parameters — the browser never sees your API secret.
// ─────────────────────────────────────────────

import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS for asset URLs
});

export default cloudinary;