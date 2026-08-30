# Media Studio — Revision 6

Standalone GitHub/Vercel-ready all-in-one **photo + video media studio**.

Revision 6 moves Media Studio beyond a photo enhancer and turns video into a first-class editing workflow. The goal is a simpler, project-focused alternative to a CapCut-style workflow for interiors, exteriors, stone, construction, real-estate and social-media content.

## What is new in Revision 6

### Unified photo + video workflow
- Photos and videos live inside the same project and the same **Original / Edited** Media library.
- All edits are non-destructive: the imported original is preserved.
- **Auto Enhance** is optional and every result can be manually overridden.
- Existing professional looks remain available: Auto, Luxury Interior, Bright Interior, Natural Stone, Exterior and Cinematic.
- Natural Stone is designed as the conservative preset for marble, granite, quartzite and quartz so color and veining remain realistic.

### New Video Studio
- Dedicated live video preview.
- Project video timeline with clip selection.
- Reorder clips left/right.
- Trim In / Trim Out controls.
- Set trim points directly from the current playhead.
- Split a clip at the playhead into two virtual clips.
- Playback speed: 0.25x through 2x.
- Clip volume / mute control.
- Per-clip transition metadata: None, Fade, Dissolve, Dip to black.
- Aspect ratio preview: Original, 9:16, 16:9, 1:1 and 4:5.
- Output target: Source, 1080p or 4K.
- Frame rate target: 24, 30 or 60 fps.
- Text overlay with live preview and adjustable text size.
- **Auto Match Clips** copies the current visual treatment to selected project video clips for a consistent walkthrough/reel look.

### Video Auto Enhance + manual control
- Auto Enhance samples the current video frame and selects a useful starting look.
- Manual Light, Color and Detail controls continue to work on video previews in real time.
- Brightness, Contrast, Highlights, Shadows, Temperature, Tint, Saturation, Vibrance, Clarity, Sharpness and Vignette remain non-destructive.

### Browser-rendered video export
- Revision 6 includes a best-effort processed video renderer using browser-native Canvas + MediaRecorder when supported.
- It attempts to render the selected trim, speed, color treatment, aspect ratio, text overlay, resolution and frame rate.
- The edited render is saved into the Media library when the browser successfully creates it.
- Browser codec/container support differs by iPhone/iOS/Safari version. If processed rendering is unavailable, Media Studio keeps the original and all edit settings rather than damaging or replacing the source.
- Long-form 4K rendering, stabilization, advanced noise reduction, multi-clip final assembly, music/voiceover mixing and AI object removal are better suited to the planned processing backend.

## Existing photo workflow retained
- Full-image aspect-fit preview on iPhone.
- Before / After, Edited and Original views.
- Large touch-friendly live adjustment slider.
- Light / Color / Detail quick-edit categories while the photo stays visible.
- Batch looks.
- Full-resolution JPG export.
- Media library with Original and Edited entries.

## Media Library
- Dedicated **Media** section.
- Filters: All / Originals / Edited.
- Project filter.
- Original downloads.
- Edited photo exports.
- Edited video render download when a browser render has been successfully created.

## Included icon assets
The selected black-and-gold Media Studio camera-lens artwork remains the official identity.

- `icon-1024.png` — master / App Store artwork
- `icon-512.png` — PWA / high-resolution web
- `icon-384.png`, `icon-256.png`, `icon-192.png`
- `icon-180.png` / `apple-touch-icon.png`
- `icon-167.png`, `icon-152.png`, `icon-144.png`, `icon-128.png`, `icon-120.png`
- `icon-96.png`, `icon-64.png`, `icon-48.png`
- `favicon-32x32.png`, `favicon-16x16.png`, `favicon.ico`

## GitHub + Vercel
All files are intentionally placed directly at the repository root for the normal main-branch workflow.

1. Extract the Revision 6 ZIP.
2. Open the Media Studio GitHub repository and switch to `main`.
3. Replace/upload every file from the ZIP directly in the repository root.
4. Commit the changes.
5. Vercel will redeploy the connected repository automatically.
6. No build command is required; Framework Preset may remain **Other**.

## iPhone update note
Revision 6 uses a new service-worker cache. After Vercel finishes deploying, close the old Safari tab and reopen the deployed site. If an installed Home Screen version still shows Revision 5, remove the Home Screen shortcut and add it again after opening the new deployment in Safari.

## Local storage note
Projects, originals, edit settings and saved edited media are currently stored in browser IndexedDB. Clearing site data or moving to another device can remove locally stored projects. Cloud backup/sync is still a planned backend feature.

## Planned backend-enabled upgrades
- Reliable multi-clip final timeline rendering.
- Stabilization.
- Advanced noise reduction and sharpening.
- AI sky / object / construction-debris removal.
- Music library and voiceover.
- Audio ducking and mixing.
- Auto Reel / 15s / 30s / 60s assembly.
- Cloud project sync and cross-device backup.
