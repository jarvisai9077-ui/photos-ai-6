# RF Photos — PRD

## Original problem statement
Build RF Photos (RF Alphabet): premium Android-first, 100% offline, local-first photo gallery + visual intelligence + creative OS (master spec §0–§115). User requested a fresh build in this workspace (no existing codebase was present), all features in one go, no fake functionality.

## Architecture
- Expo SDK 57 + expo-router; no backend calls (template backend unused). All data on device.
- Local DB: versioned JSON store (`src/store`) persisted via `@/src/utils/storage`, migration on hydrate, interrupted-job recovery.
- Media engine: `expo-media-library/legacy` (MediaStore) with paginated incremental indexing + change listener; web preview uses imported media.
- Editor: expo-image-manipulator (geometry) + Skia colour matrix (native) / Canvas (web); always saves new copies + version records.
- Vault: salted SHA-256 PIN in secure store, expo-local-authentication, app-sandbox copies (not encrypted — disclosed).
- Backup: SHA-256 manifests, SAF folder export (Android), restore preview, recovery drill.

## Implemented (2026-06)
Tabs: Photos, Albums, Create, Library. Screens: search, collection/[key], viewer, inspector, picker, editor, camera, collage, documents, vault, storage, agent, automation, privacy-export, backup, privacy, memories, atlas, moments, timemachine, brand, health, models, clipboard, planner, settings, status.
Testing: iteration_1 (2 crashes fixed), iteration_2 all 10 flows pass (web).

## Honest gaps / backlog
- P0: Native-build modules: OCR (ML Kit), video editing (Media3/FFmpeg), AR face mesh, encryption at rest, ML models (classification, faces, background removal)
- P1: Curves/HSL/LUT shaders, layers & masks, free-form crop/perspective, relationship graph, infinite canvas, photo book layout, conflict resolver UI
- P2: Client proofing, family timeline, live sessions, lens/template packs, private profiles, 3D reconstruction

## Iteration 3 (2026-10-24)
- Fixed picker "Select 1" (unmount cleanup resolved [] early; max=1 now replaces choice), selection (long-press, select all/deselect/clear, per-day), share (Android copies to cache first; sequential multi-share), delete (handles system-dialog cancel).
- Import: system photo picker / file browser → app storage, dedupe vs gallery, EXIF capture date (web JPEG EXIF reader), video posters. Expo Go Android → import mode (no MediaStore access possible); installed build → full MediaStore index (granular perms, limited-access banner + manage, Settings deep link).
- Video viewer: no Pressable wrapper, autoplay, textureView, playable-URI resolve, error fallback (Try again / Open with).
- Offline memory slideshows (/slideshow): monthly memories, events, selection, collections, Create tool; fade/slide/zoom, Ken Burns, inline video, save/replay. Not exported as a video file (user choice).
- Date-grouped FlashList grid everywhere (Today/Yesterday/d MMMM yyyy).
- Privacy Policy & Terms (/legal/*), support jarvisai9077@gmail.com; links in Settings, Privacy Center, permission + camera screens.
- New RF logo (scripts/make-logo.py → icon, adaptive, splash, favicon); app id com.rfalphabet.rfphotos; Emergent refs removed.
## Backlog
- Real MP4 export of slideshows (needs native encoder), background music, multi-file share in one sheet (needs native share module).
