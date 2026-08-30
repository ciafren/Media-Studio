# Media Studio — Revision 2

Standalone GitHub/Vercel-ready professional photo and video media editor.

## Revision 2 changes

- Removed all N&J Stone / NJ Stone branding.
- Product is now named **Media Studio** as its own standalone entity.
- Added the approved black-and-gold camera-lens identity throughout the app.
- Added production-ready web/PWA/iOS icon assets.
- Added favicon support and Apple Home Screen icon support.
- Updated PWA manifest and service-worker cache.
- Updated export filenames to use `_MediaStudio.jpg`.

## Included icon assets

- `icon-1024.png` — master / App Store source artwork
- `icon-512.png` — PWA / high-resolution web icon
- `icon-384.png`
- `icon-256.png`
- `icon-192.png` — Android/PWA icon
- `icon-180.png` and `apple-touch-icon.png` — iPhone/iPad Home Screen
- `icon-167.png`, `icon-152.png`, `icon-144.png`, `icon-128.png`, `icon-120.png`
- `icon-96.png`, `icon-64.png`, `icon-48.png`
- `favicon-32x32.png`, `favicon-16x16.png`, `favicon.ico`

All files are placed directly in the repository root so they can be uploaded straight to the GitHub **main** branch.

## GitHub + Vercel

1. Create or open the Media Studio GitHub repository.
2. Make sure you are on the `main` branch.
3. Upload every file from this folder directly to the repository root.
4. Commit the changes to `main`.
5. In Vercel, import the GitHub repository or redeploy the existing project.
6. No build command is required.
7. Framework preset can remain **Other**.

## iPhone Home Screen

When the deployed site is opened in Safari and added to the Home Screen, iOS will use `apple-touch-icon.png`.

## Current functionality

- iPhone-first responsive interface
- Project-based photo/video organization
- Multi-file upload
- Non-destructive photo editing
- Before/after comparison
- Auto Enhance
- Luxury Interior, Bright Real Estate, Natural Stone, Exterior, and Cinematic presets
- Exposure, contrast, highlights, shadows, temperature, saturation, vibrance, clarity, sharpness, and vignette controls
- Batch apply to selected photos
- Full-resolution JPG export
- Video organization and live preset preview

## Storage note

Revision 2 stores projects and media locally in the browser with IndexedDB. Clearing browser/site data or changing devices can remove locally stored projects. Cloud backup/sync is not yet included.
