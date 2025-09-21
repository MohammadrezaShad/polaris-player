# Player V2 — Step 1 (Structure Only)

This package defines the folder layout and placeholder files for the new ports & adapters architecture.
No logic is implemented yet. You can drop this into `src/` and wire later.

## Folders
- `ports.ts`: shared interfaces and types
- `core/`: domain events and player state
- `adapters/`: replaceable implementations (engine, ads, analytics, storage, thumbs, media-session, cast, drm)
- `providers/`: React providers (context wiring)
- `integrations/`: mappers from source metadata to ports
- `ui/skins/`: design tokens & base styles
