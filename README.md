# Media Studio — Rebuild Revision 1 (Flat Main Branch)

This package is the same React/Vite rebuild, reorganized so **every project file is at the GitHub repository root**. There are no `src/`, `components/`, `store/`, `lib/`, `public/`, or `icons/` folders.

## Upload to GitHub
1. Open the existing Media Studio repository and switch to `main`.
2. Delete the old application files first so they do not conflict with the rebuild.
3. Extract this ZIP.
4. Select **all files inside the ZIP** and upload them together directly to the repository root.
5. Commit the changes.
6. Vercel will redeploy from the same repository.

## Vercel
- Framework preset: Vite (normally auto-detected)
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## Important
The project is intentionally flattened for easier iPhone/GitHub uploading. The source remains modular React/TypeScript; only the folder hierarchy was removed and the import paths were updated.
