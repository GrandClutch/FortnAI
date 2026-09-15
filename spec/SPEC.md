# FortnAI Phase 1 Implementation Specification

## 1. Purpose Of This Document

This document explains the current Phase 1 setup for FortnAI in a way that is useful to both people and AI coding tools.

It documents:

- What has already been implemented
- Why each major feature was added
- Where the feature is implemented in the codebase
- How the feature works from request to response
- Which PocketBase collections are required
- Which fields belong in each collection
- Which Phase 1 items are incomplete
- The recommended order for finishing Phase 1
- How to run and verify the application

This document describes the application code as it currently exists. It does not restore or modify any files that have been deleted from the worktree.

## 2. Current Phase 1 Status

Phase 1 is not completely finished yet.

The core prototype flow is implemented:

1. A user can register or sign in.
2. The server can identify the authenticated user with an HttpOnly cookie.
3. An authenticated user can submit a room photo and room measurements.
4. The server stores the project and uploaded image in PocketBase.
5. The server asks Gemini for a design analysis.
6. The server validates and solves the generated layout.
7. The server stores the design run and design version.
8. The server can render a persisted design.
9. The server stores the render as an asset.
10. Ownership checks prevent users from operating on another user's project data.

The main work still required before calling Phase 1 complete is:

- Importing and verifying the PocketBase collections
- Adding email verification and password reset flows
- Adding CSRF or Origin validation to state-changing routes
- Adding a reliable project resume flow after a page refresh
- Adding per-user quotas and stronger production-grade rate limiting
- Adding structured observability and usage tracking
- Completing the remaining upload and layout safety checks
- Running a full end-to-end test with PocketBase and Gemini configured

## 3. Technology And Runtime Overview

The application uses:

| Area | Technology | Purpose |
|---|---|---|
| Web application | Next.js App Router | Pages and server API routes |
| UI | React and TypeScript | Input flow, authentication UI, design results, and rendering UI |
| Validation | Zod | Request, persisted data, and generated design validation |
| AI analysis | Vercel AI SDK and Google Gemini | Image analysis and structured design generation |
| Image rendering | Google Gemini image model | Render a design using the original room image and persisted design |
| Database and files | PocketBase | Users, projects, runs, versions, and image assets |
| Authentication | PocketBase auth plus server cookies | User identity and authenticated requests |
| Testing | Vitest | Unit-level validation |

The application is split into two processes during development:

- Next.js runs the FortnAI application.
- PocketBase runs separately as the backend database and file server.

The deleted development helper scripts are intentionally not recreated. `npm run dev` starts Next.js only.

## 4. Implemented Features

### 4.1 Authentication And Identity

#### What was added

- Email/password signup
- Email/password login
- Logout
- Current-user endpoint
- Google OAuth start and callback routes
- HttpOnly authentication cookies
- Server-side user lookup
- Server-side ownership checks
- Role and permission helper modules

#### Why it was added

Projects, uploaded room photos, generated designs, and renders are user-owned data. The server must know who is making a request and must not trust a user ID supplied by the browser.

#### Where it is implemented

| File or area | Responsibility |
|---|---|
| `app/api/auth/signup/route.ts` | Creates a new user and starts a session |
| `app/api/auth/login/route.ts` | Authenticates with email and password |
| `app/api/auth/logout/route.ts` | Clears the session |
| `app/api/auth/me/route.ts` | Returns the current authenticated user |
| `app/api/auth/google/start/route.ts` | Starts Google OAuth |
| `app/api/auth/google/callback/route.ts` | Completes Google OAuth and creates the session |
| `lib/pocketbase/server.ts` | Creates a request-scoped PocketBase client and manages cookies |
| `lib/auth/requireUser.ts` | Requires an authenticated user in server code |
| `lib/auth/authorization.ts` | Checks record ownership and authorization |
| `lib/auth/permissions.ts` | Defines role and permission behavior |
| `lib/auth/types.ts` | Shared authentication types |
| `components/auth-provider.tsx` | Provides client authentication state |
| `components/auth-modal.tsx` | Login and signup UI |
| `components/profile-button.tsx` | Signed-in and signed-out profile controls |

#### How it works

1. The browser submits credentials to a Next.js auth route.
2. The route validates the request body.
3. PocketBase authenticates or creates the user.
4. The server stores the PocketBase auth state in an HttpOnly cookie.
5. Later server routes create a request-scoped PocketBase client from that cookie.
6. Protected routes call `requireUser()` before reading or changing user data.
7. Ownership is derived from the authenticated session, not from an untrusted client owner ID.

#### Current limitation

Email verification and password reset are not implemented yet. The current auth routes cover signup, login, logout, current-user lookup, and Google OAuth.

### 4.2 Project Creation And Image Upload

#### What was added

- Authenticated project creation
- Multipart form upload for room photos
- Room width, length, and height persistence
- Optional style preset persistence
- Optional custom design direction persistence
- Obstacle persistence as JSON
- Asset metadata such as MIME type and byte size
- Project-to-room-photo relation

#### Why it was added

The room photo and measurements are the source input for the design process. They must be stored before the AI is called so that the operation can be retried, audited, and resumed without trusting a large browser payload.

#### Where it is implemented

| File or area | Responsibility |
|---|---|
| `app/api/projects/route.ts` | Validates the multipart request and creates the project and room-photo asset |
| `lib/persistence/schema.ts` | Validates persisted project input and obstacle data |
| `lib/client.ts` | Client-side image preparation and data conversion helpers |
| `lib/pocketbase/files.ts` | Reads protected PocketBase files through the server |
| `app/page.tsx` | Collects measurements, style, custom direction, obstacles, and photo |

#### How it works

1. The user enters room measurements and optional design direction.
2. The client prepares and compresses the image before upload.
3. The browser sends `multipart/form-data` to `POST /api/projects`.
4. The route authenticates the user and validates all fields.
5. The route creates a `projects` record owned by the authenticated user.
6. The route creates an `assets` record for the room photo.
7. The project links to the room-photo asset.
8. The API returns identifiers used by the analysis request.

#### Current limitation

MIME type and byte-size validation exist. A complete server-side pixel-dimension and file-content validation layer is still recommended.

### 4.3 Custom Design Direction And Style Presets

#### What was added

- Optional custom prompt field
- Maximum prompt length enforcement
- Style preset selection
- Ability to deselect a style preset
- Shared style prompt definitions
- Shared prompt builders for analysis and rendering

#### Why it was added

Users need to guide the design without replacing the room measurements and safety rules. Centralizing the prompt construction prevents analysis and rendering from applying different style instructions.

#### Where it is implemented

| File | Responsibility |
|---|---|
| `lib/schema.ts` | Style types and custom prompt sanitization |
| `lib/prompts.ts` | Preset briefs and shared analysis/render prompt builders |
| `app/page.tsx` | Custom direction textarea and style selection UI |
| `app/api/projects/route.ts` | Persists the selected style and custom direction |
| `app/api/design/route.ts` | Uses the shared analysis prompt builder |
| `app/api/design/render/route.ts` | Uses the shared render prompt builder |

### 4.4 AI Design Analysis

#### What was added

- Authenticated `POST /api/design`
- Project and asset loading from PocketBase
- Design run creation before the Gemini call
- Structured Gemini output validation
- Layout solver integration
- Design version persistence
- Run status updates
- Safe error handling
- Idempotency protection

#### Why it was added

The AI operation can be slow, expensive, or fail. Creating a run before calling Gemini gives the application a durable record of the attempt. Saving the result as a version means the design is not lost when the page changes or the request finishes.

#### Where it is implemented

| File | Responsibility |
|---|---|
| `app/api/design/route.ts` | Main analysis API route |
| `lib/schema.ts` | Generated design and input schemas |
| `lib/placement.ts` | Furniture placement and layout constraints |
| `lib/safety.ts` | Unsafe-content blocklist and response helper |
| `lib/prompts.ts` | Analysis system and user prompts |
| `lib/persistence/schema.ts` | Persisted project input validation |

#### How it works

1. The client sends `projectId`, `assetId`, and an optional idempotency key.
2. The server authenticates the request.
3. The server loads the project and image asset by trusted server-side ownership checks.
4. The server validates the persisted project input.
5. The server rejects unsafe custom direction before calling Gemini.
6. The server creates a `designRuns` record with an analysis status.
7. Gemini returns structured design data.
8. Zod validates the generated result.
9. The placement solver checks bounds, clearances, obstacles, and furniture limits.
10. The server creates a `designVersions` record.
11. The run is marked completed and linked to the output version.
12. The response returns the persisted identifiers and design result.

### 4.5 AI Image Rendering

#### What was added

- Authenticated `POST /api/design/render`
- Rendering from a trusted persisted version
- Protected room-photo loading
- Generated image asset persistence
- Link from the render asset to the design version and run
- Idempotency protection
- Generic client-safe error responses

#### Why it was added

Rendering must use the saved design version rather than accepting arbitrary design data from the browser. This prevents a client from changing the design after validation and keeps the render associated with a known project and run.

#### Where it is implemented

| File | Responsibility |
|---|---|
| `app/api/design/render/route.ts` | Render API route |
| `lib/pocketbase/files.ts` | Server-side access to protected files |
| `lib/prompts.ts` | Render prompt construction |
| `lib/schema.ts` | Design data validation |
| `components/before-after-slider.tsx` | Before/after result UI |
| `components/room-3d-viewer.tsx` | Design visualization UI |

#### How it works

1. The client sends `projectId`, `versionId`, and an optional idempotency key.
2. The server authenticates the user.
3. The server loads the owned project and design version.
4. The server loads the original room photo through the server.
5. The server validates the stored design data.
6. The server creates a render `designRuns` record.
7. Gemini generates the render.
8. The server stores the render in `assets`.
9. The server links the asset to the design version and run.
10. The response returns a safe image response and persisted identifiers.

### 4.6 Safety, Validation, And Guardrails

#### What was added

- Input schema validation
- Room dimension bounds
- Obstacle count and range validation
- Furniture count and size constraints
- Unsafe term blocklist
- Client-side unsafe prompt check on submit
- Server-side unsafe prompt check before model calls
- AI refusal instructions for unsafe text or images
- Generated design schema validation
- Layout warnings and solver checks
- Generic provider error responses

#### Why it was added

The system handles user-uploaded images, user-controlled text, and paid model calls. Validation must happen before model calls where possible, and generated output must be checked before it is rendered or persisted.

#### Where it is implemented

| File | Responsibility |
|---|---|
| `lib/safety.ts` | Unsafe terms and safety messages |
| `lib/schema.ts` | Design, furniture, room, and prompt schemas |
| `lib/placement.ts` | Geometric placement and bounds checks |
| `lib/persistence/schema.ts` | Stored project input validation |
| `lib/prompts.ts` | AI safety instructions |
| `app/api/design/route.ts` | Pre-call and post-response checks |
| `app/api/design/render/route.ts` | Render input and stored design checks |
| `app/api/projects/route.ts` | Upload and project validation |

#### Current limitations

- There is no dedicated vision moderation call for uploaded photos.
- Door-access path validation is not complete; minimum clearances are handled, but a full path test is still needed.
- Pixel dimensions and file-content validation should be strengthened server-side.

### 4.7 Layout And UI Bug Fixes

The implementation also addressed the following behavior:

- Style presets can be deselected.
- Custom direction is retained and sent to both analysis and rendering.
- Blank or invalid change-input states were corrected.
- Rotated furniture extents are considered when checking room bounds.
- Solver positions and heights are clamped to safe ranges.
- Minimum item clearance is applied.
- Obstacle bounds and obstacle count are validated.
- Stable item identifiers are used instead of duplicate furniture names.
- Negative budget behavior is prevented.
- Render controls avoid duplicate active submissions.

The main UI is implemented in `app/page.tsx`, with reusable UI behavior in the `components/` directory.

## 5. API Workflow Summary

### 5.1 Authentication Flow

```text
Browser
  -> POST /api/auth/signup or /api/auth/login
  -> PocketBase authentication
  -> HttpOnly cookie
  -> Browser uses cookie on later same-origin requests
```

### 5.2 Project Flow

```text
Browser form
  -> POST /api/projects multipart form
  -> Validate user, measurements, obstacles, and image
  -> Create projects record
  -> Create roomPhoto assets record
  -> Link project to asset
  -> Return projectId and assetId
```

### 5.3 Analysis Flow

```text
Browser
  -> POST /api/design { projectId, assetId, idempotencyKey }
  -> Require authenticated user
  -> Load owned project and asset
  -> Create analysis designRuns record
  -> Call Gemini
  -> Validate generated DesignResult
  -> Solve and validate layout
  -> Create designVersions record
  -> Complete designRuns record
```

### 5.4 Render Flow

```text
Browser
  -> POST /api/design/render { projectId, versionId, idempotencyKey }
  -> Require authenticated user
  -> Load owned project, version, and room photo
  -> Create render designRuns record
  -> Call Gemini image model
  -> Create render assets record
  -> Link asset to version and run
  -> Return render result
```

## 6. PocketBase Collections

The following five collections are required for the backend.

The schema uses these collection IDs:

| Collection | ID |
|---|---|
| `users` | `_pb_users_auth_` |
| `projects` | `fortaiprojects1` |
| `designRuns` | `fortairuns00001` |
| `designVersions` | `fortaiversions1` |
| `assets` | `fortaiassets001` |

The relations depend on these IDs. If a collection is manually created with a different ID, every relation referring to it must be updated consistently.

### 6.1 `users` Collection

This is a PocketBase auth collection. PocketBase supplies the normal auth fields such as email, password, verified state, and authentication timestamps. The application adds the custom fields below.

| Field | Type | Required | Purpose | Constraints / Notes |
|---|---|---:|---|---|
| `displayName` | text | No | Name shown in the application profile UI | Maximum 120 characters |
| `role` | text | No | Application role used by server-side authorization helpers | Maximum 32 characters; signup must default to `user` and must not accept an elevated client value |
| `created` | autodate | Automatic | Record creation timestamp | Enabled on create |
| `updated` | autodate | Automatic | Last record update timestamp | Enabled on create and update |

Recommended auth rules:

| Rule | Recommended behavior |
|---|---|
| List | User can list only their own user record |
| View | User can view only their own user record |
| Create | Controlled by PocketBase auth signup behavior |
| Update | User can update only their own user record |
| Delete | User can delete only their own user record |

Important behavior:

- The `role` field is not trusted from signup input.
- Unknown roles must fail closed in permission checks.
- Server code remains the source of truth for application authorization.

### 6.2 `projects` Collection

This is the top-level record for one user's room design project.

| Field | Type | Required | Purpose | Relation / Constraints |
|---|---|---:|---|---|
| `owner` | relation | Yes | User who owns the project | Relation to `users`; one user per project |
| `title` | text | Yes | Project display name | Maximum 120 characters |
| `status` | select | No | Overall project state | `processing`, `ready`, `failed`, or `archived` |
| `roomWidthFt` | number | Yes | Room width in feet | Must pass application dimension validation |
| `roomLengthFt` | number | Yes | Room length in feet | Must pass application dimension validation |
| `roomHeightFt` | number | Yes | Room height in feet | Must pass application dimension validation |
| `stylePreset` | text | No | Selected style preset | Maximum 32 characters; may be empty when deselected |
| `customPrompt` | text | No | User's additional design direction | Maximum 2,000 characters after server sanitization |
| `obstacles` | JSON | No | Walls, doors, windows, or other room obstacles | Must pass obstacle count and range validation |
| `lastOpenedAt` | date | No | Last time the project was opened | Used for resume/history behavior |
| `archivedAt` | date | No | Time the project was archived | Empty unless archived |
| `roomPhotoAsset` | relation | No | Original room photo | Relation to `assets`; one asset |
| `currentVersion` | relation | No | Current selected design version | Relation to `designVersions`; one version |
| `thumbnailAsset` | relation | No | Optional project thumbnail | Relation to `assets`; one asset |
| `created` | autodate | Automatic | Project creation timestamp | Enabled on create |
| `updated` | autodate | Automatic | Last project update timestamp | Enabled on create and update |

Important behavior:

- `owner` must always be set from the authenticated session.
- The browser must not be allowed to choose another owner.
- `roomPhotoAsset`, `currentVersion`, and `thumbnailAsset` are relations used to navigate the project graph.
- The application currently performs ownership checks in server code.
- A project should not be considered ready until its required processing has completed.

### 6.3 `designRuns` Collection

This collection records each analysis or render attempt. It is the operational history of model work.

| Field | Type | Required | Purpose | Relation / Constraints |
|---|---|---:|---|---|
| `project` | relation | Yes | Project being processed | Relation to `projects`; one project |
| `owner` | relation | Yes | User who started the run | Relation to `users`; must match project owner |
| `kind` | select | No | Type of model operation | `analysis` or `render` |
| `status` | select | No | Current run state | `queued`, `running`, `awaiting_review`, `completed`, `failed`, or `cancelled` |
| `model` | text | No | Model used for the operation | Maximum 120 characters |
| `idempotencyKey` | text | Yes | Prevents duplicate processing | Maximum 160 characters; unique per project according to the schema index |
| `errorMessage` | text | No | Safe failure information | Maximum 2,000 characters; must not contain secrets or tokens |
| `usageData` | JSON | No | Model usage and cost information | Currently available for future structured usage tracking |
| `startedAt` | date | No | Time model work started | Set when processing starts |
| `finishedAt` | date | No | Time model work finished | Set on completion or failure |
| `inputAsset` | relation | No | Asset used as model input | Relation to `assets` |
| `inputVersion` | relation | No | Version used as render input | Relation to `designVersions` |
| `outputVersion` | relation | No | Version produced by analysis | Relation to `designVersions` |
| `outputAsset` | relation | No | Asset produced by rendering | Relation to `assets` |
| `created` | autodate | Automatic | Run creation timestamp | Enabled on create |
| `updated` | autodate | Automatic | Last run update timestamp | Enabled on create and update |

Important behavior:

- Create the run before calling Gemini.
- Mark failures with safe information instead of returning raw provider errors.
- Use the idempotency key to prevent duplicate charges and duplicate active work.
- The `owner` must agree with the authenticated user and the related project owner.
- `usageData` is the intended location for future token, latency, and cost data.

### 6.4 `designVersions` Collection

This collection stores a validated design result. Each new analysis or rerun creates a new version instead of overwriting the previous design.

| Field | Type | Required | Purpose | Relation / Constraints |
|---|---|---:|---|---|
| `project` | relation | Yes | Project containing the version | Relation to `projects`; one project |
| `owner` | relation | Yes | User who owns the version | Relation to `users`; must match project owner |
| `versionNumber` | number | Yes | Increasing version number | Used to identify reruns and history order |
| `sourceRun` | relation | Yes | Run that created the version | Relation to `designRuns`; one run |
| `inputSnapshot` | JSON | No | Input values used at analysis time | Useful for audit and reproducibility |
| `designData` | JSON | Yes | Validated structured design result | Must pass the application design schema |
| `layoutWarnings` | JSON | No | Warnings from the placement solver | Examples include clearance or fit warnings |
| `status` | select | No | Version lifecycle state | `draft`, `approved`, or `superseded` |
| `renderAsset` | relation | No | Generated image for this design | Relation to `assets`; one render asset |
| `created` | autodate | Automatic | Version creation timestamp | Enabled on create |
| `updated` | autodate | Automatic | Last version update timestamp | Enabled on create and update |

Important behavior:

- `designData` must be validated before persistence.
- A render request must load `designData` from this collection rather than trusting a design object supplied by the browser.
- Rerunning analysis creates a new version.
- Older versions should remain available for future history and comparison behavior.

### 6.5 `assets` Collection

This collection stores room photos, generated renders, and optional thumbnails.

| Field | Type | Required | Purpose | Relation / Constraints |
|---|---|---:|---|---|
| `project` | relation | Yes | Project that owns the file | Relation to `projects`; one project |
| `owner` | relation | Yes | User who owns the file | Relation to `users`; must match project owner |
| `kind` | select | No | Asset purpose | `roomPhoto`, `render`, or `thumbnail` |
| `file` | file | Yes | Stored image file | One file; maximum 8 MB; JPEG, PNG, or WebP |
| `mimeType` | text | No | MIME type captured during upload | Maximum 120 characters |
| `sizeBytes` | number | No | File size captured during upload | Used for validation and diagnostics |
| `contentHash` | text | No | Optional content hash | Maximum 128 characters; useful for deduplication |
| `expiresAt` | date | No | Optional cleanup time | Used by a future orphan/expiry cleanup job |
| `sourceRun` | relation | No | Run that created the asset | Relation to `designRuns` |
| `designVersion` | relation | No | Version associated with the asset | Relation to `designVersions` |
| `created` | autodate | Automatic | Asset creation timestamp | Enabled on create |
| `updated` | autodate | Automatic | Last asset update timestamp | Enabled on create and update |

Important behavior:

- Room photos and renders must be associated with the correct project and owner.
- Files should be served through server-side access or short-lived URLs, not exposed as unrestricted public files.
- The current schema has the file constraints, but the protected-file configuration and cleanup process still need confirmation or implementation.
- Orphaned assets should eventually be removed by a scheduled cleanup process.

## 7. Collection Relationship Map

```text
users
  |
  +--< projects
  |       |
  |       +--< designRuns
  |       |      |
  |       |      +--> designVersions
  |       |      +--> assets
  |       |
  |       +--< designVersions
  |       |      |
  |       |      +--> assets
  |       |
  |       +--< assets
  |
  +--< designRuns
  +--< designVersions
  +--< assets
```

The practical ownership rule is:

```text
authenticated user
  -> owns project
  -> owns project assets
  -> owns project runs
  -> owns project versions
```

Every server route that reads or writes project data must verify this chain. A relation ID supplied by the browser is not sufficient proof of ownership.

## 8. Completed Phase 1 Checklist

The following items are implemented or substantially implemented:

- [x] PocketBase server client and request-scoped authentication handling
- [x] Email/password signup
- [x] Email/password login
- [x] Logout
- [x] Current-user endpoint
- [x] Google OAuth start and callback flow
- [x] HttpOnly session cookie behavior
- [x] Server-side `requireUser` helper
- [x] Server-side ownership checks
- [x] Role field design and fail-closed unknown-role behavior
- [x] Authenticated project creation
- [x] Multipart room-photo upload
- [x] Client-side image preparation and compression
- [x] MIME and byte-size upload validation
- [x] Room dimensions and obstacle validation
- [x] Custom design direction
- [x] Optional style preset selection and deselection
- [x] Design analysis API
- [x] Design run persistence before model execution
- [x] Structured generated design validation
- [x] Layout solver and placement checks
- [x] Design version persistence
- [x] Render API based on persisted project and version data
- [x] Render asset persistence
- [x] Idempotency keys for analysis and render operations
- [x] Unsafe prompt blocklist
- [x] AI safety/refusal instructions
- [x] Generic client-safe provider errors
- [x] Basic request rate limiting
- [x] Unit tests and static validation already run during development

## 9. Partially Complete Phase 1 Items

### 9.1 Resume After Refresh

The server persists projects, runs, versions, and assets. However, the current main page does not yet provide a complete project-history or project-loading experience.

Result:

- The database data survives a browser refresh.
- The current UI state may not be restored after a refresh.
- A project route or project loader is needed to restore the correct project, current version, and render state.

### 9.2 File Validation

Current support includes MIME and byte-size checks. Recommended additions:

- Verify the actual file signature instead of trusting only the MIME header.
- Read image dimensions server-side.
- Reject images outside practical width and height limits.
- Consider decompression-bomb and malformed-image protections.

### 9.3 Role Permissions

Role and permission helpers exist, and ownership checks are used. There are not yet multiple user-facing roles requiring route-level permission gates.

When admin or moderator behavior is added, apply explicit permission checks in the relevant server routes. Do not rely only on frontend visibility.

### 9.4 Observability

Run status, timestamps, model names, and error messages are represented in the schema. Full operational observability is still incomplete because request IDs, structured logs, token usage, cost, and latency reporting are not consistently implemented.

### 9.5 Protected Files

The application reads files through server-side helpers and performs ownership checks. The PocketBase file-field protection configuration should still be verified in the live backend, and production access should use protected files or short-lived access URLs.

## 10. Not Yet Completed

These items should not be marked as complete in a Phase 1 report:

1. **Email verification**
   - Add request and confirmation routes.
   - Add UI and clear session behavior for unverified accounts.

2. **Password reset**
   - Add request-reset and confirm-reset flows.
   - Do not expose whether an email exists.

3. **CSRF and Origin protection**
   - Validate Origin or a trusted CSRF token for state-changing browser requests.
   - Apply this to auth, project, design, and render mutations.

4. **Per-user quotas**
   - Add user-based analysis and render quotas.
   - Keep IP-based throttling as a separate abuse-control layer.
   - Return a safe quota response without exposing internal limits unnecessarily.

5. **General concurrency controls**
   - Idempotency prevents duplicate requests with the same key.
   - A broader per-user and per-project concurrency policy is still needed.

6. **Provider abstraction**
   - The API routes currently call Gemini through the AI SDK directly.
   - Introduce a small provider interface before adding multiple model providers or extensive retry behavior.

7. **Image moderation**
   - Current photo safety relies on prompt instructions.
   - Decide whether Phase 1 requires a dedicated image moderation call or whether the prompt-only approach is acceptable for the prototype.

8. **Orphaned asset cleanup**
   - Add a scheduled process for expired, unlinked, or failed-run assets.
   - Ensure cleanup checks ownership and relation state before deletion.

9. **Door-access path validation**
   - Minimum spacing is checked.
   - A full path from the room entrance through the usable room area is still needed.

10. **Structured observability**
    - Add request IDs.
    - Record safe stage names, duration, model, token usage, and estimated cost.
    - Add a way for operators to identify failed or stuck runs.

11. **Integration and end-to-end testing**
    - Unit tests do not prove that PocketBase relations, cookies, Gemini calls, and file storage work together.
    - Add a configured test environment and API smoke tests.

## 11. Recommended Order To Finish Phase 1

### Step 1: Import And Verify PocketBase Collections

Use the schema definition to create the five collections in PocketBase. Verify:

- Collection IDs match the values in Section 6.
- All relation fields point to the correct collection IDs.
- Select values match the application strings exactly.
- File size and MIME constraints are present.
- Auth rules do not allow cross-user access.
- The file field is protected or served only through a controlled backend path.

Create one test user and verify that the application can sign in and call `/api/auth/me`.

### Step 2: Configure Environment Variables

Set the values required by the current runtime:

```text
GEMINI_API_KEY=your-key
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
POCKETBASE_URL=http://127.0.0.1:8090
AUTH_OAUTH_SECRET=long-random-secret
```

Keep secrets server-only. Do not place Gemini or PocketBase admin credentials in client-exposed variables.

### Step 3: Run The Existing Smoke Flow

Verify this sequence manually:

1. Sign up.
2. Sign out.
3. Sign in.
4. Confirm the profile button shows the authenticated user.
5. Upload a valid room image.
6. Enter valid room dimensions.
7. Create a project.
8. Run design analysis.
9. Confirm a `designRuns` record is created and completed.
10. Confirm a `designVersions` record is created.
11. Request a render.
12. Confirm a render `assets` record is created.
13. Confirm the render is linked to the design version.

### Step 4: Verify Ownership And Failure Cases

Test that:

- An unauthenticated request receives `401`.
- User A cannot load User B's project.
- User A cannot render User B's version.
- Invalid dimensions receive `400`.
- Invalid obstacles receive `400`.
- Unsafe custom direction does not call Gemini.
- Reusing an idempotency key does not create a duplicate active run.
- A provider failure marks the run as failed and does not expose a raw provider error.

### Step 5: Finish Security-Critical Gaps

The recommended minimum before declaring Phase 1 complete is:

1. Add Origin or CSRF checks.
2. Add email verification and password reset.
3. Confirm protected file behavior.
4. Add per-user quotas.
5. Add server-side pixel and file-content validation.
6. Add a project-loading or resume route.

### Step 6: Add Operational Visibility

Add:

- Request IDs returned in responses and included in logs
- Run stage and duration logging
- Model and provider name
- Token and cost data where available
- A stuck-run detection strategy
- Safe error details for internal operators

### Step 7: Run Automated Checks

From the FortnAI project directory, run:

```powershell
npm run lint
npm run build
npm test
npx tsc --noEmit
```

Then run the configured API smoke tests against a local PocketBase instance.

## 12. Local Development Instructions

### Start PocketBase

The PocketBase executable is in the sibling backend directory. Start it separately:

```powershell
cd ..\backend
.\pocketbase.exe serve --http=127.0.0.1:8090
```

Keep this process running while using project, auth, or design APIs.

### Start Next.js

From the FortnAI directory:

```powershell
npm run dev
```

The current `dev` script starts Next.js only. It does not start PocketBase.

### Import The Schema

Use the PocketBase dashboard or the supported PocketBase schema import process with the schema definition maintained for the project. Verify the collections and relations after import before testing the application.

Do not assume that a schema file existing in the repository means the live PocketBase instance has been configured. The live backend must be checked directly.

## 13. Guidance For Future AI Changes

An AI coding tool working on this project should follow these rules:

1. Never trust `owner`, `userId`, or relation ownership values supplied by the browser.
2. Always call the server authentication helper before protected operations.
3. Load project, asset, run, and version records through an ownership-checked path.
4. Validate request bodies before model calls.
5. Validate generated model output before persistence or rendering.
6. Do not send full-resolution base64 images through JSON design requests.
7. Keep Gemini credentials and PocketBase admin credentials server-only.
8. Do not log API keys, auth cookies, file contents, or raw image data.
9. Use idempotency keys for paid or non-repeatable model operations.
10. Preserve prior design versions instead of overwriting them during reruns.
11. Return generic client errors and store safe internal failure information.
12. Update this document when a Phase 1 item changes from pending to complete.
13. Do not recreate deleted helper scripts unless explicitly requested.

## 14. Definition Of Phase 1 Complete

Phase 1 can be considered complete when all of the following are true:

- [ ] The five PocketBase collections exist in the live backend with the correct IDs and relations.
- [ ] Authenticated users can sign up, sign in, sign out, verify email, and reset passwords.
- [ ] State-changing routes have CSRF or Origin protection.
- [ ] Users can create a project and reload it after a browser refresh.
- [ ] Users can access only their own projects, assets, runs, and versions.
- [ ] Project uploads have server-side type, size, dimension, and content validation.
- [ ] Analysis and render operations are idempotent.
- [ ] Failed model operations are recorded without leaking provider details.
- [ ] Per-user quotas and request limits are active.
- [ ] Generated designs are schema-validated and layout-validated.
- [ ] Unsafe text is blocked before paid model calls.
- [ ] File access is protected.
- [ ] Orphaned assets have a cleanup strategy.
- [ ] Request, model, latency, token, cost, and failure information is observable.
- [ ] Automated checks pass.
- [ ] A full authenticated analysis-and-render smoke test passes against the configured backend.

Until the unchecked items above are completed, the application should be described as a working Phase 1 prototype rather than a fully production-ready Phase 1 implementation.
