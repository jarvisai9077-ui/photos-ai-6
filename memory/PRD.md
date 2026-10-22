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
