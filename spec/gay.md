# FortnAI PocketBase Collections

This document describes the proposed PocketBase collections for FortnAI.

Each collection works like a database table. Each field is an attribute or column on
that collection.

PocketBase automatically provides these fields on every record:

```text
id
created
updated
```

## Collection Relationships

```text
users
  -> owns projects
       -> contains assets
       -> contains designRuns
       -> contains designVersions
```

The browser should communicate with Next.js Route Handlers, not directly with
PocketBase. Next.js should verify authentication, ownership, and permissions before
performing database operations.

Protected PocketBase collections use this authentication-only rule:

```text
@request.auth.id != ""
```

Ownership and role permissions are enforced in server-side application code.

---

## 1. `users`

This is PocketBase's built-in authentication collection. It stores account information
and login credentials.

| Field | Type | Purpose |
|---|---|---|
| `email` | Email | User's login email. |
| `password` | Password | Securely managed by PocketBase. |
| `verified` | Boolean | Whether the user's email has been verified. |
| `displayName` | Text | Name displayed in the application. |
| `role` | Text | Current role, such as `user`, `designer`, or `admin`. |

### Important notes

- `password` must never be created as a normal custom field.
- New roles are defined in application code, not as PocketBase select options.
- New users should receive the default role `user`.
- Signup must never allow the browser to choose an elevated role.
- Role permissions are defined in files such as `lib/auth/permissions.ts`.

### Example user record

```json
{
  "id": "user_alice_001",
  "email": "alice@example.com",
  "verified": true,
  "displayName": "Alice",
  "role": "user"
}
```

---

## 2. `projects`

A project is the main container for one room design. It is the record that appears in a
user's design history.

| Field | Type | Purpose |
|---|---|---|
| `owner` | Relation to `users` | The user who owns the project. |
| `title` | Text | Project name, such as `Bedroom Design`. |
| `status` | Select or Text | `draft`, `processing`, `ready`, `failed`, or `archived`. |
| `roomWidthFt` | Number | Room width in feet. |
| `roomLengthFt` | Number | Room length in feet. |
| `roomHeightFt` | Number | Room height in feet. |
| `stylePreset` | Text | Selected style, such as `japandi`. |
| `customPrompt` | Text | The user's additional design direction. |
| `obstacles` | JSON | Doors and windows in the room. |
| `roomPhotoAsset` | Relation to `assets` | The original room photo. |
| `currentVersion` | Relation to `designVersions` | The version currently shown to the user. |
| `thumbnailAsset` | Relation to `assets` | Small image used in the history list. |
| `lastOpenedAt` | Date | The last time the user opened the project. |
| `archivedAt` | Date | When the project was archived, if applicable. |

### Example project record

```json
{
  "id": "project_bedroom_001",
  "owner": "user_alice_001",
  "title": "Alice's Bedroom Design",
  "status": "ready",
  "roomWidthFt": 12,
  "roomLengthFt": 14,
  "roomHeightFt": 9,
  "stylePreset": "japandi",
  "customPrompt": "Keep the room calm and add more closed storage.",
  "obstacles": [
    {
      "type": "door",
      "wallRef": "south",
      "offsetFt": 3.5,
      "widthFt": 3,
      "swingClearanceFt": 3
    }
  ],
  "roomPhotoAsset": "asset_photo_001",
  "currentVersion": "version_bedroom_002",
  "thumbnailAsset": "asset_thumbnail_001",
  "lastOpenedAt": "2026-09-10 14:30:00"
}
```

---

## 3. `assets`

An asset is a file connected to a project. Assets store files, not design decisions.

Examples include the original room photo, a generated redesign, or a history thumbnail.

| Field | Type | Purpose |
|---|---|---|
| `project` | Relation to `projects` | The project that uses the file. |
| `owner` | Relation to `users` | The user who owns the file. |
| `kind` | Select or Text | `roomPhoto`, `render`, or `thumbnail`. |
| `file` | File | The actual uploaded or generated image. |
| `mimeType` | Text | For example, `image/jpeg` or `image/png`. |
| `sizeBytes` | Number | File size in bytes. |
| `contentHash` | Text | Helps detect duplicate files. |
| `sourceRun` | Relation to `designRuns` | The AI run that created the file, if applicable. |
| `designVersion` | Relation to `designVersions` | The version associated with the file, if applicable. |
| `expiresAt` | Date | Optional cleanup date for temporary files. |

### Example room photo asset

```json
{
  "id": "asset_photo_001",
  "project": "project_bedroom_001",
  "owner": "user_alice_001",
  "kind": "roomPhoto",
  "file": "alice-bedroom-original.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1843200,
  "contentHash": "sha256:example-photo-hash",
  "sourceRun": null,
  "designVersion": null,
  "expiresAt": null
}
```

### Example render asset

```json
{
  "id": "asset_render_001",
  "project": "project_bedroom_001",
  "owner": "user_alice_001",
  "kind": "render",
  "file": "alice-bedroom-japandi-render.png",
  "mimeType": "image/png",
  "sizeBytes": 2457600,
  "contentHash": "sha256:example-render-hash",
  "sourceRun": "run_render_001",
  "designVersion": "version_bedroom_002",
  "expiresAt": null
}
```

Room photos and renders should be protected. They should be served through Next.js or
short-lived authorized URLs rather than public permanent URLs.

---

## 4. `designRuns`

A design run represents one AI job or processing attempt.

Examples:

- Analyze a room photo.
- Generate a photorealistic render.
- Retry a failed analysis.

A run is the work being performed. It may fail and create no design version.

| Field | Type | Purpose |
|---|---|---|
| `project` | Relation to `projects` | The project that requested the job. |
| `owner` | Relation to `users` | The user who started the job. |
| `kind` | Select or Text | `analysis` or `render`. |
| `status` | Select or Text | `queued`, `running`, `completed`, `failed`, or `cancelled`. |
| `model` | Text | Gemini model used for the job. |
| `inputAsset` | Relation to `assets` | Image used by the job. |
| `inputVersion` | Relation to `designVersions` | Design version used for rendering. |
| `outputVersion` | Relation to `designVersions` | Version created by an analysis job. |
| `outputAsset` | Relation to `assets` | Render created by a render job. |
| `idempotencyKey` | Text | Prevents accidental duplicate jobs and charges. |
| `errorMessage` | Text | Safe explanation if the job fails. |
| `usageData` | JSON | Token usage, cost, duration, and retry information. |
| `startedAt` | Date | When processing started. |
| `finishedAt` | Date | When processing finished. |

### Example analysis run

```json
{
  "id": "run_analysis_001",
  "project": "project_bedroom_001",
  "owner": "user_alice_001",
  "kind": "analysis",
  "status": "completed",
  "model": "gemini-3.6-flash",
  "inputAsset": "asset_photo_001",
  "inputVersion": null,
  "outputVersion": "version_bedroom_001",
  "outputAsset": null,
  "idempotencyKey": "analysis-project_bedroom_001-001",
  "errorMessage": null,
  "usageData": {
    "durationMs": 8200,
    "estimatedCostUsd": 0.04,
    "retryCount": 0
  },
  "startedAt": "2026-09-10 14:00:00",
  "finishedAt": "2026-09-10 14:00:08"
}
```

### Example failed render run

```json
{
  "id": "run_render_001",
  "project": "project_bedroom_001",
  "owner": "user_alice_001",
  "kind": "render",
  "status": "failed",
  "model": "gemini-2.5-flash-image",
  "inputAsset": "asset_photo_001",
  "inputVersion": "version_bedroom_002",
  "outputVersion": null,
  "outputAsset": null,
  "idempotencyKey": "render-version_bedroom_002-001",
  "errorMessage": "The render could not be completed. Please try again.",
  "usageData": {
    "retryCount": 1
  },
  "startedAt": "2026-09-10 14:20:00",
  "finishedAt": "2026-09-10 14:21:10"
}
```

The detailed provider error should be logged securely on the server, not returned in
`errorMessage` to the user.

---

## 5. `designVersions`

A design version is a saved result from a successful design process.

Versions should not be overwritten. If the user changes the design, the system creates
a new version while keeping the previous version available in history.

| Field | Type | Purpose |
|---|---|---|
| `project` | Relation to `projects` | The project this version belongs to. |
| `owner` | Relation to `users` | The user who owns the version. |
| `versionNumber` | Number | Version number, such as 1, 2, or 3. |
| `sourceRun` | Relation to `designRuns` | The run that created the version. |
| `inputSnapshot` | JSON | Room dimensions, style, prompt, and obstacles used. |
| `designData` | JSON | Theme, furniture, budget, palette, lighting, and layout. |
| `layoutWarnings` | JSON | Placement issues or solver warnings. |
| `renderAsset` | Relation to `assets` | Optional generated render for this version. |
| `status` | Select or Text | `draft`, `approved`, or `superseded`. |

The `designData` JSON contains the validated structured result. It can include:

- `designTheme`
- `spatialStrategy`
- `furnitureRecommendations`
- `totalEstimatedBudget`
- `lightingAdvice`
- `colorPalette`
- `layout`

There is no need to create a separate PocketBase collection for each furniture item,
budget line, or color. They can remain inside the validated `designData` JSON.

### Example design version

```json
{
  "id": "version_bedroom_002",
  "project": "project_bedroom_001",
  "owner": "user_alice_001",
  "versionNumber": 2,
  "sourceRun": "run_analysis_002",
  "inputSnapshot": {
    "width": 12,
    "length": 14,
    "height": 9,
    "stylePreset": "japandi",
    "customPrompt": "Keep the room calm and add more closed storage.",
    "obstacles": []
  },
  "designData": {
    "designTheme": "Warm Japandi bedroom with calm natural textures",
    "spatialStrategy": "Keep the bed on the south wall and preserve a clear path to the door.",
    "furnitureRecommendations": [
      {
        "item": "Low platform bed",
        "category": "Bed",
        "width": 66,
        "depth": 84,
        "height": 18,
        "estimatedCostUSD": 650
      }
    ],
    "totalEstimatedBudget": 1450,
    "lightingAdvice": "Use warm layered lighting with a soft paper shade.",
    "colorPalette": ["#E8E0D2", "#B7A58A", "#334F3E"],
    "layout": [
      {
        "itemId": "item-0",
        "item": "Low platform bed",
        "category": "Bed",
        "x": 6,
        "z": 11,
        "rotationDeg": 0,
        "widthFt": 5.5,
        "depthFt": 7,
        "heightFt": 1.5,
        "estimatedCostUSD": 650,
        "placementNotes": "Centered against the south wall.",
        "status": "ok"
      }
    ]
  },
  "layoutWarnings": [],
  "renderAsset": "asset_render_001",
  "status": "approved"
}
```

---

## Complete Example Flow

```text
1. Alice creates a project called "Alice's Bedroom Design".
2. Her uploaded room photo is saved as an Asset.
3. An analysis designRun processes the photo and measurements.
4. The successful result becomes designVersion 1.
5. Alice changes the design direction and starts another designRun.
6. The new successful result becomes designVersion 2.
7. Version 1 remains available in history.
8. Alice requests a render for version 2.
9. A render designRun creates a generated image Asset.
10. The render Asset is connected to designVersion 2.
```

## Simple Difference

- `projects`: the main room design container.
- `assets`: files belonging to the project.
- `designRuns`: AI jobs and processing attempts.
- `designVersions`: saved design results.
- `users`: the accounts that own projects and files.
