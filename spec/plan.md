# FortnAI - Production Roadmap

> Goal: turn FortnAI from a single-call "ChatGPT wrapper" prototype into a
> production-grade AI interior design workflow.

## Roadmap Overview

Today the app is essentially:

```text
room photo -> one Gemini analysis call -> deterministic layout -> optional render
```

The application already has valuable foundations:

- Structured Gemini output validated with zod.
- A deterministic furniture placement solver.
- Door and window obstacle support.
- A 3D room viewer using GLTF furniture models.
- Detailed style prompts and basic safety guardrails.

The missing pieces are identity, persistence, reliable background execution,
production security, saved design history, and a workflow in which AI performs
several specialized steps instead of generating one opaque answer.

The work is divided into four phases:

1. **Phase 1 - PocketBase Production Foundation**
   Authentication, ownership, persistence, media handling, security, and reliable runs.
2. **Phase 2 - Authenticated Design History**
   Saved projects, versions, assets, reopening, and history management for signed-in users.
3. **Phase 3 - Genuine AI Design Workflow**
   Room audit, design brief, candidate layouts, critique, approval, sourcing, and revisions.
4. **Phase 4 - Testing and Quality Assurance**
   Automated tests, CI, end-to-end flows, and AI evaluation.

Testing is listed as the final phase for clarity, but the test setup must begin during
Phase 1 and grow alongside every later phase.

---

## 0. Current State

| Area | Current implementation |
|---|---|
| UI | `app/page.tsx` keeps the complete flow in React state. |
| Analysis | `POST /api/design` calls `generateObject`, then `solveLayout`. |
| Rendering | `POST /api/design/render` calls Gemini image-to-image. |
| Storage | None. Photos are sent as full base64 data URLs. |
| Authentication | None. All routes are publicly callable. |
| Persistence | None. Designs disappear when browser state is lost. |
| History | None. There are no accounts or saved projects. |
| Tests | No test runner or test script exists in `package.json`. |
| AI provider | Google Gemini only. |
| 3D plan | Deterministic solver plus React Three Fiber viewer. |

### Chosen backend

PocketBase is the planned backend because the team already knows it. It should run as
a separate HTTPS service with persistent storage. It should not run on a serverless
filesystem such as a typical Vercel function filesystem.

Next.js should remain the backend-for-frontend. The browser talks to same-origin
Next.js routes, and those routes communicate with PocketBase and Gemini server-side.

```text
Browser
  -> Next.js Route Handlers
       -> PocketBase authentication, records, and files
       -> Gemini analysis and image generation
```

---

## 1. Bugs and Risks to Fix First

These are known problems in the current codebase. They should be fixed during Phase 1
because they affect security, correctness, cost, or user trust.

### Critical

1. **Public, unauthenticated AI spending**
   - `app/api/design/route.ts:17-55` and `app/api/design/render/route.ts:11-51`
     have no authentication, rate limiting, quota, request-size limit, or image validation.
   - Anyone can repeatedly trigger paid Gemini calls.
   - **Fix:** require an authenticated user for generation, then add per-user quotas
     and separate analysis/render rate limits.

2. **Provider credential in the local environment file**
   - `.env:1` contains a Google provider credential.
   - It is git-ignored, but it must be rotated if it was ever shared or committed.
   - **Fix:** keep credentials in deployment secret storage and never expose them to
     browser code or logs.

### High

3. **"Change inputs" can leave the UI blank**
   - `app/page.tsx:580-585` calls `setDesign(null)` but does not reset `phase` to
     `"input"`.
   - The input UI requires `phase === "input"`; the result UI requires a design.
   - **Fix:** restore the input phase and clear only result-specific state.

4. **The render route trusts client-controlled design data**
   - `app/api/design/render/route.ts:20-33` only checks that `design` exists.
   - A caller can inject unsafe or misleading text through design fields.
   - **Fix:** accept a stored `projectId` and `versionId`, load the trusted version on
     the server, and reject arbitrary client-supplied design objects.

5. **Rotated furniture dimensions disagree between solver and viewer**
   - `lib/placement.ts:131-137` swaps width and depth for a 90-degree rotation.
   - The viewer rotates the already-swapped item again in
     `components/room-3d-viewer.tsx:42-50`.
   - Collision geometry and displayed geometry can therefore disagree.
   - **Fix:** keep physical dimensions in one format and apply rotation exactly once.

6. **Furniture can be placed outside the room or through the ceiling**
   - `lib/placement.ts:148-158` does not clamp an initial wall offset.
   - `heightFt` is accepted but not used to validate whether an item fits vertically.
   - **Fix:** validate room ranges, clamp wall positions, and reject or flag items that
     cannot fit within the room height.

7. **The 24-inch walkway guarantee exists only in the prompt**
   - `lib/prompts.ts:18-20` asks Gemini to leave 24-inch walkways.
   - `lib/placement.ts:190-195` only checks rectangle overlap.
   - **Fix:** add minimum-clearance and door-access checks to the deterministic solver.

8. **The photoreal render is not driven by the solved layout**
   - `lib/prompts.ts:92-107` uses furniture names and recommended dimensions.
   - It ignores solved `x`, `z`, rotation, and obstacle positions.
   - **Fix:** render from an approved stored layout version and clearly label the image
     as illustrative because Gemini cannot guarantee pixel-level geometry.

### Medium

9. **Obstacle validation is incomplete**
   - `lib/schema.ts:63-69` allows negative offsets, oversized widths, negative swing
     clearance, and unlimited obstacle counts.
   - **Fix:** bound every field and cap the obstacle array.

10. **Render requests can race**
    - The Re-render button remains active during a request in `app/page.tsx:587-595`.
    - An older response can overwrite a newer image.
    - **Fix:** disable duplicate requests and use request IDs or an `AbortController`.

11. **Duplicate furniture names can break React row state**
    - `app/page.tsx:557-558` and `635-637` use `f.item` as a React key.
    - **Fix:** generate stable unique `itemId` values and use them as keys.

12. **Budget prices can become negative**
    - `app/page.tsx:652-668` accepts negative values and can display negative savings.
    - **Fix:** clamp prices to zero and never display negative savings.

13. **Malformed request bodies can become 500 responses**
    - Both routes treat `req.json()` as an object without validating null or shape.
    - **Fix:** validate request bodies with zod and return 400 for client input errors.

14. **Provider error details are returned to clients**
    - Both routes return raw caught error messages.
    - **Fix:** return safe generic messages to clients and log diagnostic details only
      on the server.

15. **File-reading failures are unhandled**
    - `app/page.tsx:46-55` awaits `fileToBase64` without a controlled error path.
    - **Fix:** catch file errors and show a recoverable upload message.

16. **There are no automated tests**
    - `package.json` has no test script and no test files exist.
    - **Fix:** establish the test runner during Phase 1, not after all features are built.

---

## 2. Identity and Ownership Model

The system must know which design belongs to which person without trusting the browser.

PocketBase will provide the authentication gate. FortnAI's server-side application
code will provide ownership, role, and permission checks. This keeps authorization
logic versioned with the application instead of scattering it across PocketBase Admin
rules.

### Authentication flow

1. The user signs up or logs in through Next.js routes.
2. The route authenticates against PocketBase's users auth collection.
3. Next.js stores the PocketBase session in an `HttpOnly`, `Secure`, `SameSite=Lax`
   cookie.
4. The PocketBase token is never exposed to client-side JavaScript or stored in
   `localStorage`.
5. Each protected Route Handler creates a request-scoped PocketBase client, loads and
   refreshes the cookie, and obtains the authenticated PocketBase user ID and role.
6. The server uses that authenticated user ID as the owner of every project, asset,
   `designRuns` record, and `designVersions` record.
7. The server checks ownership and permissions before every protected operation.
8. The browser never supplies an `ownerId` or permission decision. Client-supplied
   owner and role fields are ignored.

### Auth endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- Password reset endpoints.
- Email verification endpoints.

### Authorization placement

The PocketBase rule for protected collections is intentionally authentication-only:

```text
@request.auth.id != ""
```

Use that rule for the list, view, create, update, and delete operations on protected
collections. It means that the PocketBase requester must be authenticated, but it does
not decide which authenticated user owns a record or which role may perform an action.

Ownership and role authorization belong in the server-side Next.js application code:

```text
lib/auth/requireUser.ts
lib/auth/permissions.ts
lib/auth/authorization.ts
```

The normal server-side authorization sequence is:

1. Verify the PocketBase session.
2. Load the requested record.
3. Check that the record belongs to the authenticated user, unless the role has an
   explicit permission to access other users' records.
4. Check the required application permission.
5. Perform the operation only after all checks pass.

The browser frontend may hide or show buttons based on the user's role, but browser
checks are only for presentation. They are not a security boundary because a user can
modify client-side JavaScript or call an API directly.

Define role names and permissions in application code. Store the user's current role
as a plain text `role` field on the PocketBase auth record, with `user` as the default.
Do not use a PocketBase select field with a fixed list of role options if adding a new
role should not require a PocketBase schema change.

Adding a future role should require:

1. Adding the role and its permissions to `lib/auth/permissions.ts`.
2. Adding or updating server-side checks in `lib/auth/authorization.ts` if needed.
3. Deploying the application.
4. Assigning the role value to selected users through a protected application admin
   route or internal admin UI.

It should not require changing PocketBase collection rules. Unknown roles must fail
closed and receive no elevated permissions.

The browser must not connect directly to PocketBase. If users could call PocketBase
directly with their own tokens, an authentication-only rule would allow them to query
records belonging to other authenticated users. All PocketBase access must therefore go
through the Next.js backend-for-frontend, where ownership and role checks run.

### Authentication policy

The recommended first production policy is to require sign-in before the user starts
an AI design. This makes ownership unambiguous and prevents anonymous users from
consuming paid model calls.

If anonymous generation is later required, anonymous users should receive only a
temporary draft. A server-managed guest cookie can control quotas, but it must never be
treated as ownership. Signing in would then claim and migrate that draft into the user's
PocketBase account.

---

# Phase 1 - PocketBase Production Foundation

**Goal:** make requests secure, owned, persisted, resumable, and operationally visible.

Phase 1 is the foundation for every later feature. Do not build a larger AI workflow
on top of public synchronous endpoints and browser-only state.

## 1.1 Authentication and identity

- [ ] Install and configure the PocketBase client on the server side.
- [ ] Create sign-up, sign-in, logout, verification, and password reset flows.
- [ ] Add an auth UI that clearly shows signed-out and signed-in states.
- [ ] Store sessions in HttpOnly cookies managed by Next.js.
- [ ] Add `/api/auth/me` returning only safe user fields.
- [ ] Protect all design and history routes.
- [ ] Derive ownership from the server-side session.
- [ ] Add `lib/auth/requireUser.ts` for authenticated request handling.
- [ ] Add `lib/auth/permissions.ts` with the application role-to-permission map.
- [ ] Add `lib/auth/authorization.ts` with ownership, role, and permission helpers.
- [ ] Store a plain text `role` field with a safe default such as `user`.
- [ ] Never allow signup requests to select an elevated role.
- [ ] Keep frontend role checks limited to navigation and UI visibility.
- [ ] Add CSRF and Origin checks to mutation routes.

## 1.2 PocketBase collections

Use the following collections as the base data model:

| Collection | Important fields |
|---|---|
| `users` | PocketBase auth collection, `displayName`, plain text `role` |
| `projects` | `owner`, title, status, room dimensions, style, prompt, obstacles, `currentVersion`, thumbnail, timestamps |
| `assets` | `project`, `owner`, kind, protected file, MIME type, size, hash, source run, expiry |
| `designRuns` | `project`, `owner`, kind, status, model, error, idempotency key, timestamps, usage data |
| `designVersions` | `project`, `owner`, version number, run, input snapshot, validated design result, render reference |

Use this authentication-only PocketBase rule for protected collections:

```text
@request.auth.id != ""
```

Apply it to list, view, create, update, and delete rules for `projects`, `assets`,
`designRuns`, and `designVersions`. Do not add owner or role conditions to the
PocketBase Admin rule. Those decisions belong in the Next.js server code.

The `users` collection has an intentional exception for account creation so a signed-out
person can register. Login, logout, verification, and password reset remain handled by
the authentication flow.

Keep `owner` and `project` immutable through Route Handler allowlists and the server-side
authorization helpers. PocketBase remains the authentication and data service; the
application code remains the authorization source of truth.

## 1.3 Media handling

- [ ] Upload room photos as multipart data rather than large base64 JSON bodies.
- [ ] Validate MIME type, byte size, image dimensions, and file contents server-side.
- [ ] Resize, orient, and compress photos before upload.
- [ ] Store room photos and renders as protected PocketBase file fields.
- [ ] Keep data URLs only for short-lived local previews.
- [ ] Serve private files through the Next.js backend or short-lived authorized URLs.
- [ ] Add cleanup for orphaned files.

## 1.4 Reliable design runs

- [ ] Introduce run states: `queued`, `running`, `awaiting_review`, `completed`,
      `failed`, and `cancelled`.
- [ ] Change `/api/design` to accept a `projectId` and `assetId`.
- [ ] Create a `designRuns` record before calling Gemini.
- [ ] Save the validated analysis result and solved layout as a new design version.
- [ ] Change `/api/design/render` to accept a `projectId` and `versionId`.
- [ ] Load trusted input and design data from PocketBase instead of trusting arbitrary
      client payloads.
- [ ] Store generated renders as assets.
- [ ] Add idempotency keys so retries do not duplicate paid model calls.
- [ ] Make reruns create new versions instead of overwriting previous results.
- [ ] Persist enough state for the browser to resume after refresh.

## 1.5 Validation and safety

- [ ] Add strict maximum and minimum room dimensions.
- [ ] Add strict obstacle ranges and a maximum obstacle count.
- [ ] Validate image data before any model call.
- [ ] Validate generated design fields after the model response.
- [ ] Scan generated design fields before sending them to the render model.
- [ ] Keep the custom prompt blocklist as the first safety layer.
- [ ] Add image moderation or a dedicated safety screening decision for uploaded photos.
- [ ] Keep system and user prompt refusal instructions as defense in depth.
- [ ] Ensure unsafe input results in zero model calls whenever possible.

## 1.6 Cost controls and security

- [ ] Add per-user analysis quotas.
- [ ] Add separate render quotas because image generation is more expensive.
- [ ] Add request rate limits and concurrency limits.
- [ ] Add maximum prompt, image, furniture, and obstacle sizes.
- [ ] Keep Gemini and PocketBase service credentials server-only.
- [ ] Never log API keys, auth tokens, or complete private room images.
- [ ] Return generic error messages to clients.
- [ ] Perform role and permission checks in server-side application code.
- [ ] Make unknown roles fail closed with no elevated permissions.
- [ ] Add a provider interface around Gemini so model changes stay isolated.

## 1.7 Observability

- [ ] Add request IDs to every API request and run.
- [ ] Log stage, model, latency, retries, token usage, and estimated cost.
- [ ] Track failed and stuck runs.
- [ ] Store safe failure information on `designRuns`.
- [ ] Add an internal admin view or log query for operational issues.

## 1.8 Required bug fixes

- [ ] Fix the "Change inputs" blank screen.
- [ ] Fix rotated furniture dimension handling.
- [ ] Clamp solver positions and validate furniture height.
- [ ] Add minimum-clearance and door-access validation.
- [ ] Add obstacle bounds and array limits.
- [ ] Prevent concurrent render requests and stale responses.
- [ ] Use stable item IDs for all React keys.
- [ ] Prevent negative budget values and negative savings.
- [ ] Validate malformed request bodies.
- [ ] Stop returning raw provider errors.
- [ ] Handle upload failures in the client.

## Phase 1 completion checklist

- [ ] A user can sign up, sign in, sign out, verify an email, and reset a password.
- [ ] A signed-in user can create a project and refresh without losing it.
- [ ] Users can only access their own PocketBase records and files.
- [ ] Protected PocketBase collection rules use only `@request.auth.id != ""`.
- [ ] Ownership and role permissions are enforced by server-side Next.js code.
- [ ] Adding a role does not require editing PocketBase collection rules.
- [ ] No full-resolution base64 image is sent through the design API.
- [ ] Failed AI work can be retried without duplicating charges.
- [ ] Every layout is valid or explicitly marked with a warning.
- [ ] Analysis and rendering are rate-limited and quota-controlled.
- [ ] Model calls, costs, latency, and failures are observable.
- [ ] The existing prototype behavior works through the new backend.

---

# Phase 2 - Authenticated Design History

**Goal:** give signed-in users a reliable place to find, reopen, rename, version, and
delete their previous designs.

History should not be a separate duplicate data model. A saved project is the history
record, while its design versions, runs, and assets provide the detail.

## 2.1 Access policy

- [ ] Only authenticated users can access history.
- [ ] Signed-out users see a sign-in prompt or are redirected to sign-in.
- [ ] History APIs return `401` for signed-out requests.
- [ ] The server derives the owner from the PocketBase session.
- [ ] The API never trusts an owner ID from the browser.
- [ ] PocketBase history collections use only `@request.auth.id != ""` as their
      collection rule.
- [ ] Next.js server code checks that the project owner matches the authenticated user.
- [ ] Next.js server code checks role permissions before allowing elevated history actions.
- [ ] Frontend role checks only control visibility of history buttons and navigation.
- [ ] Changing a project ID in the URL cannot expose another user's project.

## 2.2 History data model

Extend the Phase 1 collections:

### `projects`

- `owner`
- `title`
- `status`
- `room dimensions`
- `style preset`
- `lastOpenedAt`
- `currentVersion`
- `thumbnailAsset`
- `archivedAt`
- `created` and `updated`

### `designVersions`

- Immutable validated `DesignResult`.
- Deterministic layout and layout warnings.
- Input snapshot used to create the version.
- Version number.
- Source run.
- Optional render asset.

### `assets`

- Original room photo.
- Generated render.
- History thumbnail.
- Project and owner relations.
- File size, MIME type, hash, and creation time.

Add indexes for owner plus update date so history lists remain fast as accounts grow.

## 2.3 History API

Add protected Next.js routes:

- `GET /api/history`
  - List the authenticated user's projects.
  - Sort by most recently updated.
  - Support pagination with a server-enforced maximum page size.
- `GET /api/history/:projectId`
  - Return one project, its current version, thumbnail, and available render.
- `GET /api/history/:projectId/versions`
  - Return previous versions for comparison or reopening.
- `PATCH /api/history/:projectId`
  - Rename or archive a project.
- `DELETE /api/history/:projectId`
  - Permanently delete the project and related assets after confirmation.
- `POST /api/history/:projectId/duplicate`
  - Optional later feature to start a new project from an old version.

Every route must authenticate the request, then use server-side authorization code to
verify ownership and permissions. It must avoid revealing whether a different user's
project exists. No history route should rely on a client-side role check.

## 2.4 Saving behavior

When an analysis succeeds:

1. Create a project if one does not exist.
2. Save the room photo as a protected asset.
3. Create an immutable `designVersions` record.
4. Save the solved layout and layout warnings.
5. Update `projects.currentVersion`.
6. Create a thumbnail for the history card.
7. Display the project in history.

When rendering succeeds:

1. Create a render run.
2. Load the selected design version server-side.
3. Generate and store the render as a protected asset.
4. Attach the render to the exact version that produced it.
5. Update the project history item without replacing the original room photo.

In-progress and failed runs should remain visible with status and a retry action. A
failed project should not disappear just because its model call failed.

## 2.5 History user interface

Add the following UI:

- [ ] A `History` navigation link visible to signed-in users.
- [ ] `app/history/page.tsx` for the project list.
- [ ] `app/history/[projectId]/page.tsx` for a saved project.
- [ ] A history card with room thumbnail, title, style, budget, status, and last update.
- [ ] An empty state for users without saved projects.
- [ ] Loading, error, and retry states.
- [ ] Rename action.
- [ ] Archive action.
- [ ] Delete action with confirmation.
- [ ] Open or resume action.
- [ ] Version list and version selection.
- [ ] Clear signed-out state and sign-in call to action.

The saved design page should reuse the existing blueprint, budget, exact-plan viewer,
and render components wherever possible.

## 2.6 Privacy and deletion

- [ ] Keep room photos and renders in protected PocketBase file fields.
- [ ] Delete associated assets when a project is permanently deleted.
- [ ] Define a retention policy for abandoned failed runs and old renders.
- [ ] Do not expose private file URLs indefinitely.
- [ ] Add account-level data deletion as a future privacy requirement.
- [ ] Avoid logging complete prompts, room images, or private design data.

## Phase 2 completion checklist

- [ ] Signed-out users cannot access history.
- [ ] Signed-in users see only their own projects.
- [ ] A successful design appears in history automatically.
- [ ] History survives browser refresh, logout, and later login.
- [ ] A saved project can be reopened and resumed.
- [ ] Users can rename, archive, and delete projects.
- [ ] Previous design versions remain available.
- [ ] Room photos and renders remain protected.
- [ ] Deleting a project removes its related assets.
- [ ] Failed runs can be retried from history.
- [ ] History supports pagination and remains responsive with many projects.

---

# Phase 3 - Genuine AI Design Workflow

**Goal:** replace the single "generate everything" call with a staged, inspectable
workflow. AI performs specialized work, while deterministic code remains the source
of truth for geometry and validated data.

## 3.1 Target workflow

```text
Upload room
  -> Room audit
  -> User confirmation
  -> Design brief
  -> 2-3 candidate layouts
  -> Deterministic validation
  -> AI critique and ranking
  -> User approval
  -> Budget and sourcing
  -> Photoreal render
  -> Structured revisions
  -> Saved version in history
```

## 3.2 Workflow steps

### Step 1: Room audit

- Detect room type.
- Identify existing furniture.
- Identify fixed architectural features.
- Estimate doors, windows, and lighting conditions.
- Output confidence and uncertainty.
- Ask the user to confirm important observations.
- Save the audit as part of the project version.

The user must be able to correct the audit before later AI steps use it.

### Step 2: Design brief

Convert the style preset and custom direction into explicit constraints:

- Must-have furniture.
- Items to avoid.
- Budget ceiling.
- Color requirements.
- Functional priorities.
- Room constraints.
- Existing items to keep or remove.

Show the brief in plain language and save the confirmed brief.

### Step 3: Candidate layouts

- Generate two or three meaningfully different candidates.
- Give every candidate structured furniture, dimensions, and wall relationships.
- Attach each candidate to the project and source run.
- Do not render candidates automatically.

### Step 4: Deterministic validation

Run every candidate through the placement solver:

- Room bounds.
- Furniture overlap.
- Door and window clearance.
- Door swing area.
- Minimum walkways.
- Furniture height.
- Stable item IDs.

Reject or clearly flag candidates that fail validation.

### Step 5: AI critique and ranking

Rank only valid candidates using:

- Circulation quality.
- Room function.
- Budget compliance.
- User requirements.
- Style consistency.
- Obstacle clearance.
- Practicality for a non-designer.

Return a concise explanation for each candidate instead of exposing hidden reasoning.

### Step 6: User approval

- Let the user compare candidates.
- Let the user select one candidate.
- Save the approved candidate as a design version.
- Do not make an expensive render call before approval.

### Step 7: Budget and sourcing

- Replace AI-invented shopping links with validated product or retailer records.
- Track price timestamps and availability.
- Recalculate totals from selected products.
- Keep estimates clearly separate from confirmed prices.

### Step 8: Photoreal render

- Render from the approved project version.
- Include approved layout, dimensions, palette, lighting, and obstacles.
- Store the render against the exact version that produced it.
- Label the render as illustrative rather than geometrically exact.

### Step 9: Structured revisions

Support requests such as:

- "Keep the sofa but replace the table."
- "Make this under $1,500."
- "Move the desk away from the window."
- "Use warmer colors."

Represent these as structured patches:

- Replace an item.
- Remove an item.
- Move an item.
- Change a budget limit.
- Change a style constraint.
- Change a color or material requirement.

Preserve unaffected constraints, create a new version, revalidate the layout, and show
the user what changed.

### Step 10: Decision transparency

For every major output, show:

- What the AI observed.
- What assumptions it made.
- Which constraints were satisfied.
- Which warnings remain.
- Which model and prompt versions were used.
- Which design version produced the render.

## 3.3 Cost discipline

- Expensive calls remain behind explicit user actions.
- Candidate generation, critique, and render have separate quotas.
- Reuse a saved room audit and brief when only a later step changes.
- Avoid calling a model on every keystroke.
- Track cost per project and per workflow stage.

## Phase 3 completion checklist

- [ ] A project contains persisted audit, brief, candidates, critique, approval, budget,
      and render artifacts.
- [ ] At least one valid layout is required before rendering.
- [ ] Users can compare and choose between multiple feasible plans.
- [ ] Revisions preserve approved constraints and create new history versions.
- [ ] Budget values come from validated product or catalog data.
- [ ] Every render links to the exact design and layout version that produced it.
- [ ] Each result explains assumptions and remaining warnings.
- [ ] Users can resume the workflow from history after leaving the application.

---

# Phase 4 - Testing and Quality Assurance

**Goal:** prove that the system is safe, correct, secure, and stable, then prevent
regressions as the product changes.

Testing is intentionally a named phase, but its foundation starts during Phase 1.

## 4.1 Test setup

- [ ] Add a test runner such as Vitest.
- [ ] Add a `test` script to `package.json`.
- [ ] Add React component testing.
- [ ] Add Playwright for browser end-to-end tests.
- [ ] Add CI for lint, TypeScript, build, unit tests, integration tests, and security scans.
- [ ] Use mocked Gemini calls for deterministic tests.
- [ ] Use a separate PocketBase test instance or isolated test data.

## 4.2 Solver and geometry tests

- [ ] All wall and alignment combinations stay inside room bounds.
- [ ] Positive and negative offsets behave correctly.
- [ ] Tiny rooms and oversized furniture are rejected or flagged.
- [ ] Furniture taller than the room is rejected or flagged.
- [ ] 90, 270, and negative rotations produce matching solver and viewer footprints.
- [ ] Adjacency to earlier and later items behaves deterministically.
- [ ] Duplicate furniture names do not create ambiguous references.
- [ ] Door and window boundaries are respected.
- [ ] Door swing geometry is respected.
- [ ] Minimum circulation paths are checked.
- [ ] No accepted layout contains furniture overlap.

## 4.3 Safety tests

- [ ] Existing weapon, explosive, and drug positives remain blocked.
- [ ] Normal decor terms such as "gunmetal" and "knife block" remain allowed.
- [ ] Add coverage for knives, swords, tasers, and common variants.
- [ ] Test spacing, obfuscation, leetspeak, and Unicode normalization.
- [ ] Unsafe custom prompts make zero model calls.
- [ ] Unsafe generated design fields are blocked before rendering.
- [ ] Unsafe image handling follows the chosen moderation policy.

## 4.4 Schema and API tests

- [ ] Null and malformed bodies return 400 rather than 500.
- [ ] Invalid room dimensions are rejected.
- [ ] Invalid obstacle values and excessive obstacle counts are rejected.
- [ ] Invalid MIME types and oversized images are rejected.
- [ ] Invalid render versions are rejected.
- [ ] Unauthenticated requests return 401.
- [ ] Provider failures return safe generic messages.
- [ ] Model mocks verify that validation happens before model calls.

## 4.5 Authentication and ownership tests

- [ ] User signup works.
- [ ] Login creates a valid session cookie.
- [ ] Logout removes the session.
- [ ] Session refresh and expiry work.
- [ ] Email verification works.
- [ ] Password reset works.
- [ ] A user cannot read another user's projects, assets, runs, or versions.
- [ ] Changing a project ID in the URL cannot bypass ownership rules.
- [ ] PocketBase rejects unauthenticated access with the authentication-only rule.
- [ ] Server-side authorization rejects authenticated users who do not own a record.
- [ ] Server-side authorization allows elevated access only for permitted roles.
- [ ] Frontend-only role changes cannot bypass server-side permissions.
- [ ] Unknown roles fail closed and receive no elevated permissions.
- [ ] Adding a new role in application code does not require changing PocketBase rules.
- [ ] PocketBase service credentials never reach the browser.

## 4.6 History tests

- [ ] Signed-out users cannot access history pages or APIs.
- [ ] A completed design appears in history automatically.
- [ ] History persists after refresh, logout, and later login.
- [ ] Projects are sorted and paginated correctly.
- [ ] Rename, archive, and delete work.
- [ ] Deleting a project deletes associated assets.
- [ ] Previous versions remain accessible to the owner.
- [ ] Failed runs show retry actions.
- [ ] A deleted or unauthorized project does not leak information.

## 4.7 Component and UI tests

- [ ] "Change inputs" returns to the input screen.
- [ ] Render buttons disable while a request is pending.
- [ ] Stale render responses are ignored.
- [ ] Duplicate furniture names keep independent row state.
- [ ] Negative budget values are rejected.
- [ ] Savings never display as a negative value.
- [ ] Obstacles are revalidated when room dimensions change.
- [ ] Auth-gated navigation changes correctly after login and logout.
- [ ] History empty, loading, error, and populated states render correctly.

## 4.8 3D and model smoke tests

- [ ] Every category model path exists.
- [ ] Every GLB loads in the viewer.
- [ ] A missing or corrupt GLB uses a visible fallback rather than crashing.
- [ ] Furniture orientation matches wall relationships.
- [ ] Furniture fitted dimensions match the layout dimensions.
- [ ] Obstacle markers match solver coordinates.

## 4.9 End-to-end tests

- [ ] Sign up -> sign in -> upload -> analysis -> saved history.
- [ ] Logout -> login -> reopen the same project.
- [ ] Open history -> select a version -> render that version.
- [ ] Full workflow: audit -> brief -> candidates -> approval -> render -> revision.
- [ ] Large photo is compressed and accepted.
- [ ] Unsafe prompt is blocked with a clear message.
- [ ] Model failure shows a retry path instead of a dead end.
- [ ] A user cannot access another user's project through direct URLs.

## 4.10 AI evaluation harness

Build a fixed set of representative rooms and run it against every prompt or model
change. Track:

| Metric | What it measures |
|---|---|
| Schema success rate | Model output parses correctly. |
| Layout validity rate | Candidate layouts pass deterministic validation. |
| Obstacle clearance | Doors and windows remain usable. |
| Budget compliance | Plans respect the user's budget. |
| Style adherence | Output matches the selected direction. |
| Revision success | Requested changes happen without losing constraints. |
| Safety rate | Unsafe requests are refused or excluded. |
| Cost and latency | Each workflow stage stays within budget and time targets. |
| History integrity | Saved versions and assets remain linked correctly. |

## Phase 4 completion checklist

- [ ] `npm run test` passes locally and in CI.
- [ ] Lint, typecheck, build, and tests run on every pull request.
- [ ] All critical and high-severity bugs have regression tests.
- [ ] Auth and ownership tests pass against PocketBase.
- [ ] History tests cover persistence, access control, versions, and deletion.
- [ ] The AI evaluation harness runs on a schedule.
- [ ] Safety, layout, cost, and latency regressions are detected before release.

---

## Suggested Implementation Order

```text
1. Rotate any exposed provider credentials.
2. Fix the immediate UI and solver bugs listed in Section 1.
3. Start the test runner and add regression tests for those bugs.
4. Phase 1: PocketBase deployment, authentication, and server-side authorization.
5. Phase 1: protected media, persistence, reliable runs, quotas, and observability.
6. Phase 2: authenticated history and version management.
7. Expand integration and end-to-end tests around history.
8. Phase 3: room audit, briefs, candidates, critique, approval, and revisions.
9. Expand the AI evaluation harness for every Phase 3 step.
10. Phase 4: complete release-quality test coverage and CI gates.
```

The test harness starts early even though testing is listed as Phase 4. Each completed
feature should have tests before the next feature is started.

---

## Production Readiness Definition

FortnAI is ready for a controlled production launch when:

- Users have secure accounts and can recover access.
- Every design belongs to a verified owner.
- Role and permission checks are enforced by server-side application code.
- Adding a new role does not require changing PocketBase collection rules.
- Room photos and renders are protected.
- Designs survive refreshes, failures, and later logins.
- History and versioning work reliably.
- Paid AI calls are authenticated, rate-limited, observable, and quota-controlled.
- Invalid layouts are rejected or clearly flagged.
- The AI workflow is staged and user-approved rather than opaque.
- Render outputs are linked to the exact approved design version.
- Critical behavior is covered by automated tests and CI.

---

## Product Principles

1. Measurements and budget come from structured, validated data; images are illustrative.
2. The plan must be actionable for a non-designer.
3. The design world stays minimal and editorial: Aeonik, `font-medium`, paper, and pine.
4. Expensive generative calls stay behind explicit user actions.
5. Photo, dimensions, style, constraints, and user decisions flow through every step.
6. Deterministic and server-side application code is the source of truth for geometry,
   ownership, and permissions.
7. AI decisions are persisted, explainable, and revisable.
