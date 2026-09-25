# Problems

## 3D Furniture Placement

Audit of `placement.ts`, `scene.ts`, `furnitureModels.ts`, `furnitureKit.ts`, `room-3d-viewer.tsx`. The facing math is self-consistent (model front assumed +Z; all `frontOffsetDeg` = 0); collision and wall/obstacle geometry line up.

**Medium**
- **Model orientation unverified** — every model's `frontOffsetDeg` is 0; if a Kenney model's visual front isn't +Z it faces the wall, and `facesToward`/`frontOf`/`behindOf` inherit the error. Fix is a per-model `frontOffsetDeg` (`furnitureKit.ts`); needs a live eyeball pass.
- **Dimension-driven distortion** — `fitFurnitureModel` forces every model into the AI's W×D×H (height ×1.2 tolerance), so furniture can render squished/oversized when AI dims mismatch model proportions. Rugs are fixed via `floor` mode; furniture is not.
- **Wall lamps render on the floor** — `lampWall.glb` is keyword-mapped (sconce/wall lamp) but floor-anchored (`footprint`), so those items appear as floor fixtures.

**Minor**
- Keyword gaps map to wrong-but-valid objects (console, wardrobe, closet, curtains, bench → category defaults like bookcase).
- Ceiling-light hover tooltip floats above the ceiling (`Html` offset applied on the ceiling-mounted group).
- Rugs never collide with each other (`isFloorCovering` sameKind) — two rugs can overlap.
- `onTopOf` isn't rendered vertically — decor "on" a table renders at floor level, overlapping it.
- Rotations snap to 90° (`normalizeRotation`) — no 45° corner placements.
- Obstacle "ghost zone" — furniture keeps 0.3 m clear of openings while frames render ~0.05 m.
- No shadows; transparent-ceiling haze on PNG export; camera can orbit outside the room.