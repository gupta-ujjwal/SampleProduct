---
name: integrate
description: >
  Use when the user types `/integrate`, `/integrate --product`, or asks to "integrate
  a Juspay product", "set up payments", "add payment SDK", or any variation of adding
  a Juspay payment product to their app or codebase. Activate for any Juspay payment
  integration request.
compatibility: |
  tools:
    - juspay-docs-mcp (explore_product, doc_fetch_tool)
    - juspay-mcp (juspay_get_merchant_details, juspay_get_webhook_settings, juspay_get_general_settings, juspay_create_api_key)
  mcp_servers:
    - juspay-docs-mcp
    - juspay-mcp
---

# /integrate — Juspay Integration Orchestrator

> **PRIME DIRECTIVE:** This file is a decision engine. It contains no product knowledge.
> Product knowledge lives in `products/`. Authoritative implementation facts come only from MCP tool calls — never from memory or training.
>
> **MCP PREFERENCE:** Always prefer `juspay-mcp` tools for live merchant data (credentials, settings, gateway config, integration status). Use `juspay-docs-mcp` only for documentation structure and page content.

---

## AGENT SELF-CHECK (run mentally before each phase)

- Did I complete the PRE-FLIGHT MCP authentication step? If not, trigger `mcp__juspay-mcp__authenticate()` now — or, if it fails, stop and ask the user to authenticate before continuing.
- Did I call `juspay_get_merchant_details` to establish merchant context before asking for credentials?
- Did I read `products/` before calling `explore_product`? Can I conclude from the catalog alone?
- Did I scan the codebase before asking disambiguation questions (language, framework)?
- Did I call `doc_fetch_tool` before writing any code?
- Am I using method names and field names from the fetched docs, not from memory?
- For SDK/web products: did I fetch test resources and run tests for each checklist stage wherever possible

---

## FLAG PARSING

Extract flags before starting:

| Flag              | Effect                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `--product <id>`  | Skip recommendation. Confirm the product in one line, then go to Phase 2. Still run Step 1.7 catalog-first check. |
| `--platform <id>` | Hint for platform selection in Phase 2 — still verify against codebase before asking.                    |
| `--from <step>`   | Resume from a specific step (see Entry Points). Seed the full task list; mark preceding steps completed. |

---

## RESULTS TRACKING

Every phase is bookended by two `scripts/lifecycle/integrate-results` calls: `step-start <name>` before the work begins, and `step-end <status> "<verification>"` after verification. This is what keeps per-phase timing accurate — collapsing both into a single end-of-phase call produces zero-second durations.

**Script path** (invoke with the full path from the project root):
`.claude/skills/integrate/scripts/lifecycle/integrate-results`

**Commands:**

- `init` — initialize the workflow lifecycle skeleton. Echoes `init: startedAt=<ts>`. Call once at workflow start (before task seeding).
- `step-start <name>` — call at the top of each phase before any work. Echoes `pending: <name>`.
- `step-end <status> "<verification>" ["<reason>"]` — call after the phase verifies. Echoes `recorded: <name> <status> (steps=<count>, pending=<none|name>)`.
- `step <name> <status> "<verification>" <startedAt> <completedAt> ["<reason>"]` — single-call form for phases where start time was captured in shell.
- `set <field> <value>` — store non-sensitive metadata. Echoes `set: <field>=<value>`. **The script structurally refuses fields matching `*key*`, `*secret*`, `*password*`, `*token*` (case-insensitive) — do not try to work around this.**

**Safe fields to `set`:** `product`, `platform`, `productType`, `merchantId`, `active`, `status`.

**Trust the echo.** Every mutation echoes a one-line confirmation. Treat that as proof the write succeeded; do not re-read the JSON to verify.

**If `integrate-results` or `scripts/lifecycle/done` exits with code 2** and prints a line starting with `SKILL_FALLBACK:`, neither `jq` nor Python is available. Skip all remaining `integrate-results` calls without retrying, skip the timing summary in the DONE phase, and inform the user once: "Result tracking is unavailable (no `jq` or Python found). Install either to enable per-phase timing. The integration itself will proceed normally."

**STATIC_STEPS (seeded at init, always present):** `product-select`, `platform-detect`, `doc-fetch`, `params`, `codegen`, `test`, `summary`, `done`

**DYNAMIC_STEPS (seeded mid-workflow as discovered):**

- After Phase 2 (platform confirmed): `{$PLATFORM}-setup` (if mobile platform), `checklist` (always)
- After Step 4.1 (webhook check): `webhook-config` (if webhook URL was unconfigured and user provides one)
- After Phase 5 DB scan (DB changes confirmed): `db-schema`

Dynamic step names are platform-specific: `react-native-setup`, `android-setup`, `ios-setup`, `flutter-setup`, `cordova-setup`, `capacitor-setup`. The `done` script handles arbitrary step names — no script changes needed.

**Discipline:**

- Bookend every phase with `step-start` at the top and `step-end` at the bottom. Never call `step-end` without a prior `step-start`. Back-to-back `step-start` / `step-end skipped` is allowed for auto-skipped phases.
- Never compute timestamps yourself — `integrate-results` resolves UTC internally.
- Verification strings must be credential-free (see SECURITY below).

---

## PROGRESS TRACKING

Drive the agent’s native checklist or task-tracking UI so the user can see a live view of integration progress throughout the workflow.

**At workflow start** (after `integrate-results init`, before Step 1.1), seed **the 8 STATIC_STEPS in parallel in a single assistant turn** — one `TaskCreate` call per task, all emitted as parallel `tool_use` blocks:

```
product-select, platform-detect, doc-fetch, params, codegen, test, summary, done
```

Sequential seeding is a regression — emit all `TaskCreate` calls in one turn.

**After Phase 2 (platform confirmed):** seed dynamic tasks in a single parallel batch:

- `{$PLATFORM}-setup` — if `$PLATFORM` ∈ `{android, ios, react-native, flutter, cordova, capacitor}`
- `checklist` — always

**On-demand (later phases):**

- After Step 4.1 webhook check: seed `webhook-config` task if URL was unconfigured and user provides one
- After Phase 5 DB scan confirmed: seed `db-schema` task if user agrees to schema changes

**State machine at each phase boundary:**

- Flip to `in_progress` when `step-start` is called.
- Flip to `completed` when `step-end passed` is called.
- One phase `in_progress` at a time.

**Auto-skip rules** (these phases get back-to-back `step-start` / `step-end skipped`, and their task goes straight to `completed`):

- `{$PLATFORM}-setup`: skipped when the documentation structure indicates no native SDK setup is needed for the confirmed platform. Infer this from the doc structure — if the product has no native/mobile SDK pages for `$PLATFORM`, skip with a reason stating: `"not applicable: no native/mobile SDK pages found for $PLATFORM in the doc map"`. Use the actual resolved platform name in the step (e.g., `step-start web-setup` / `step-end skipped`).

**`--from <step>` entry points:** seed the 8 STATIC_STEPS, then mark all steps before the entry point as `completed` immediately after seeding. Dynamic steps that would have been created before the entry point should also be seeded and immediately marked `completed`.

**Failure:** if a phase exhausts retries and the workflow halts, leave the failing phase `in_progress`, mark `done` completed after the failure summary, and call `integrate-results set status failed`.

---

## SECURITY

**NEVER include in step verification strings, task descriptions, Bash command arguments, or any terminal output:**

- `$API_KEY` — provisioned in Step 4.2 via `juspay_create_api_key`. Never echoed, never stored in the results file.
- `$WEBHOOK_AUTH_PASSWORD` — read from `.env` in Step 4.4. Same prohibition.
- Any value returned by `juspay_create_api_key`.
- Any credential read from `.env`, `.env.local`, or similar files.

**Correct:**

```
integrate-results step-end passed "API key provisioned and stored in env var; webhook URL configured; return URL set"
```

**Wrong:**

```
integrate-results step-end passed "API key: sk-test-AbCdEf123; webhook=https://..."
```

**The `integrate-results` script structurally rejects sensitive field names on `set` (exits 1).** Never try to work around this by renaming the field.

**When running test scripts (Step 8.2):** pass credentials via shell env vars (`export JUSPAY_API_KEY=...`), not as inline arguments visible in the Bash tool call command string.

**If a script or MCP tool response includes a credential value** (e.g., `juspay_create_api_key` returning the plaintext key), store it in an in-memory variable. Inform the user it was provisioned without echoing the value:

> "A new API key has been created and stored for this session."

---

## UI INTERACTION RULES

Whenever the user must choose between fixed options:

- Use native select / choice UI
- Do NOT ask for free-text replies if options are known
- Wait for a selection before continuing
- Do NOT rephrase the same question again after rendering choices
- **Do NOT ask for information you can derive** — from the codebase, from `juspay-mcp` live data, or from the catalog

Format choices as structured options, not inline prose.

---

## PRE-FLIGHT: MCP AUTHENTICATION

This skill relies on two MCP servers:

- **`juspay-mcp`** — live merchant data (credentials, settings, integration status). Requires authentication before any tool call.
- **`juspay-docs-mcp`** — documentation structure and page content. No authentication required.

### Authentication flow

Before calling any `juspay-mcp` tool, attempt to trigger the authentication flow using whatever mechanism your agent environment exposes (e.g. an `authenticate` tool, an OAuth handshake, or a login prompt provided by the MCP server).

**If authentication succeeds** → proceed directly to Phase 1.

**If authentication fails, the tool is unavailable, or you are unsure how to authenticate in your environment** → first, consult your own agent's documentation on how to authenticate a remote MCP server (e.g. Claude Code docs, OpenCode docs, Cursor docs — whichever agent you are). Then stop and tell the user:

> "The `juspay-mcp` server needs to be authenticated before this integration can proceed.
>
> Please check your agent's documentation on authenticating MCP servers, then re-run the integrate skill to continue."

Do **not** attempt to call any `juspay-mcp` tool before authentication succeeds. Do not proceed to Phase 1 until authentication is confirmed.

---

## PHASE 1 — Intent Collection and Product Selection

### STARTUP

Before any phase work, run these **in order**:

1. `integrate-results init` — initialize the lifecycle skeleton
2. Emit all 8 `TaskCreate` calls **in parallel in a single assistant turn** (see PROGRESS TRACKING)
3. `integrate-results set active working`

**If `--from <step>` was passed**, after seeding tasks, mark all steps before the entry point as `completed` immediately (back-to-back `step-start` / `step-end passed "resumed from --from flag"` for each preceding step, then flip those tasks to `completed`).

---

Run: `integrate-results step-start product-select` | flip `product-select` task to `in_progress`

### Step 1.1 — Load product catalog

Read all files in `products/`. Each file has: product ID, type, platforms, use cases, and intent signals.

Store the full set as `$PRODUCT_CATALOG`. This is your local knowledge for matching — do not use training-data knowledge about products.

### Step 1.2 — Auto-resolve integration type from merchant account

Call:

```
juspay-mcp:juspay_get_merchant_details()
```

Extract and store:

- `$MERCHANT_ID` — from the `merchantId` field
- `$CLIENT_ID` — always default to `$MERCHANT_ID`. **Never extract this from the API response.** Inform the user:
  > "Client ID is typically the same as your merchant ID (`$MERCHANT_ID`). If you use a different client ID, please provide it now — otherwise I'll proceed with `$MERCHANT_ID`."
  > Wait for confirmation or a custom value before continuing.
- `$INTEGRATION_TYPE` — from the `integrationType` field, which is an **array**; take the first element (e.g. `["PP"]` → `"PP"`)

Map `$INTEGRATION_TYPE` to a recommended product:

| `$INTEGRATION_TYPE`         | Recommended product ID                       |
| --------------------------- | -------------------------------------------- |
| `PP`                        | `hyper-checkout`                             |
| `ec_sdk`                    | `ec-headless`                                |
| `ec_api`                    | `ec-api`                                     |
| _(anything else or absent)_ | No inference — fall back to Step 1.4 |

### Step 1.3 — Present inferred recommendation

If a mapping was found, present a single confirmation:

> "Based on your account configuration, it looks like you're set up for **[Product Name]**.
>
> Shall I proceed with integrating **[Product Name]**?
>
> 1. Yes, proceed
> 2. No, let me choose a different product type
> 3. No, let me choose a specific product"

- **Option 1** → set `$PRODUCT` to the inferred product ID and skip to Phase 2
- **Option 2** → go to Step 1.4 (product type list)
- **Option 3** → show the full flat product list from `$PRODUCT_CATALOG` and let the user pick directly

### Step 1.4 — Ask the user what they want to build

Only reached if `$INTEGRATION_TYPE` is absent, unrecognized, or the user chose Option 2 in Step 1.3.

Derive the category list from `$PRODUCT_CATALOG` by reading each entry's `category` field and collecting the unique set. Present each unique category as a numbered option, in the order they first appear in the catalog, plus **Not sure** at the end:

> What type of product are you looking to integrate?
>
> [numbered list of unique categories from $PRODUCT_CATALOG]
> [N+1]. **Not sure**

---

### Step 1.5 — Ask the user to choose a product

Filter `$PRODUCT_CATALOG` to entries whose `category` matches the user's selection. Present each matching product's name as a numbered choice:

> Which [category] product would you like to integrate?
>
> [numbered list of products from $PRODUCT_CATALOG where category = selected category]

If the user selected **Not sure**, ask instead:

> Please describe your use case and I'll recommend the right product and integration flow.

Store the free-text response as `$INTENT` and proceed to Step 1.6.

### Step 1.6 — Match intent to candidates

Using `$INTENT` and the `intent signals` field in each `$PRODUCT_CATALOG` entry, select 1–3 products as `$CANDIDATES[]`.

Matching rules:

- "checkout UI", "payment page", "mobile SDK" → prefer `type: sdk` products
- "API only", "server-side", "REST", "backend" → prefer `type: api-only` products
- "recurring", "subscriptions", "mandates" → billing/mandate products
- "payout", "transfer", "disburse" → payout products
- "UPI", "TPAP", "P2P", "P2M" → UPI products

Aim for 1–3 candidates. Fewer is better.

### Step 1.7 — Catalog-first product resolution

**Before calling `explore_product`, check if the catalog entry is conclusive:**

A catalog entry is **conclusive** if:

- The `type` field unambiguously answers whether a platform question is needed
- The `platforms` list has only one entry, or the product type is `api-only` (no platform question needed)
- No further platform disambiguation is required to start code generation

If conclusive → skip `explore_product` for this candidate and proceed.
If **not** conclusive (e.g. hybrid type, multiple overlapping platforms, need page count for complexity signal) → call:

```
juspay-docs-mcp:explore_product({ product: <candidate-id> })
```

Extract only what you need for recommendation:

- Product title
- Platform IDs → classify type (runtime IDs = sdk, only `docs` = api-only, mix = hybrid)
- Number of numbered base integration pages (complexity signal)
- List of supported platforms if sdk/hybrid

Do not fetch individual doc pages here.

### Step 1.8 — Recommend and confirm

Present your recommendation grounded in what you read from `products/` and `explore_product`:

> "Based on what you described, here's what I recommend:
>
> **[Product Title]** — [one-line reason tied to their intent]
>
> _(Alternative)_ **[Product Title]** — [reason]
>
> Which would you like to integrate? Or pick from the full list below:"

List all products from `$PRODUCT_CATALOG` as a numbered reference so the user can override.

Store the confirmed choice as `$PRODUCT` (the product ID from the products/ file).

**After product is confirmed:**

```
integrate-results set product $PRODUCT
integrate-results set merchantId $MERCHANT_ID
integrate-results step-end passed "product confirmed: $PRODUCT; merchantId resolved"
```

Flip `product-select` task to `completed`.

---

## PHASE 2 — Platform Detection

Run: `integrate-results step-start platform-detect` | flip `platform-detect` task to `in_progress`

### Step 2.1 — Build $DOC_MAP (explore_product)

**Only call `explore_product` if it wasn't already called in Step 1.7 for `$PRODUCT`.**

If already called and `$DOC_MAP` is populated → skip directly to Step 2.3.

Otherwise call:

```
juspay-docs-mcp:explore_product({ product: $PRODUCT })
```

Read the full response. This is the authoritative doc structure. Extract and store:

- Product title and description
- `platforms[]` — every platform entry with its ID and title
- For each platform: `sections[]` → for each section: `sectionTitle`, `pages[]`
- For each page: `pageTitle` and the `md content link` URL

> Pages numbered "1. …", "2. …" are base integration pages in required order. Preserve that order exactly.

**Classify product type** by reading the documentation structure returned by `explore_product`. Infer from the platform list, section titles, and page layout whether the product requires a client SDK, is purely API/server-side, or combines both. Store the result as `$PRODUCT_TYPE` (`sdk` | `api-only` | `hybrid`) and save it:

```
integrate-results set productType $PRODUCT_TYPE
```

### Step 2.2 — Detect backend language from codebase

Scan the working directory for backend language signals and store as `$DETECTED_LANG`. Use the first unambiguous match:

| Signal found                                                                                  | `$DETECTED_LANG` |
| --------------------------------------------------------------------------------------------- | ---------------- |
| `requirements.txt`, `pyproject.toml`, or majority `*.py` files                                | `python`         |
| `tsconfig.json` with `*.ts` backend files                                                     | `typescript`     |
| `package.json` with `express`/`fastify`/`koa`/`hapi`/`nest` in deps, or majority `*.js` files | `javascript`     |
| `go.mod` or majority `*.go` files                                                             | `go`             |
| `pom.xml`, or `build.gradle` in a non-Android context, or majority `*.java` files             | `java`           |
| `Gemfile` or majority `*.rb` files                                                            | `ruby`           |
| `composer.json` or majority `*.php` files                                                     | `php`            |
| `*.csproj` or majority `*.cs` files                                                           | `csharp`         |
| `Cargo.toml` or majority `*.rs` files                                                         | `rust`           |

If multiple signals conflict, count source files per language under `server/`, `backend/`, `api/`, or the project root — pick the majority. If none found, leave `$DETECTED_LANG` unset (ask the user in Step 4.3).

### Step 2.2.5 — Single-side codebase check (SDK and hybrid products only)

**Skip this step entirely if `$PRODUCT_TYPE = api-only`.** API-only products have no client side, so the question does not apply.

Scan the working directory for both backend and frontend presence:

**Backend signals**: a dedicated `server/`, `backend/`, or `api/` directory; `package.json` with server-side deps (`express`, `fastify`, `koa`, `hapi`, `nest`); Next.js project with an `app/api/` or `pages/api/` directory; `requirements.txt`, `pyproject.toml`, `go.mod`, `pom.xml`, `build.gradle` (non-Android context), `Gemfile`, `composer.json`, `Cargo.toml`, `*.csproj`.

**Frontend signals**: `package.json` with client-side deps (`react`, `vue`, `angular`, `svelte`, `next`, `nuxt`); `index.html` at the project root; `src/` directory with `*.jsx` / `*.tsx` / `*.vue` files; `pubspec.yaml` (Flutter); `AndroidManifest.xml` or `*.xcodeproj` (native mobile).

Set `$HAS_BACKEND` and `$HAS_FRONTEND` from the scan.

If **both are present** → set `$SINGLE_SIDE_MODE = false` and continue.

If **only one side is found** → set `$SINGLE_SIDE_MODE = true` and `$MISSING_SIDE` to the absent side (`"backend"` or `"frontend"`). Then ask the user before proceeding:

> "⚠️ I can only find a **[$HAS_BACKEND → "backend" / $HAS_FRONTEND → "frontend"]** in this project. A complete **[Product]** integration normally requires both:
>
> - **Backend** — session creation, order-status check, webhook handler
> - **Frontend** — SDK initialisation and payment UI
>
> How would you like to proceed?
>
> 1. **Continue with the [$FOUND_SIDE] only** — I'll generate what's needed for this side; the integration summary will include a step-by-step checklist of what must be implemented on the [$MISSING_SIDE] before going live
> 2. **Stop — I'll add the [$MISSING_SIDE] first, then re-run `/integrate`**"

- **Option 1** → proceed with `$SINGLE_SIDE_MODE = true`
- **Option 2** → stop immediately with the message: _"No problem. Add the [$MISSING_SIDE] to your project and re-run `/integrate` when you're ready."_

If **neither** side is found (empty or unfamiliar project structure) → treat as both-present and continue; the codebase scan later phases will surface any issues.

Branch on `$PRODUCT_TYPE`:

### If `api-only`

No platform question. Backend language comes from `$DETECTED_LANG` — only ask if not detected.

```
integrate-results set platform "api-only"
integrate-results set nativeSdkRequired false
integrate-results step-end passed "api-only product; backend language: $DETECTED_LANG"
```

Flip `platform-detect` task to `completed`.

**Seed Wave 2 dynamic tasks** (in parallel, single turn):

- `checklist` — always

### If `sdk`

Detect the client platform from the codebase and confirm with the user before continuing.

### Step 2.3 — Detect platform from codebase

Before asking the user, scan the working directory for platform signals:

| File / pattern found                                                              | Detected platform     |
| --------------------------------------------------------------------------------- | --------------------- |
| `pubspec.yaml`                                                                    | `flutter`             |
| `package.json` with `react-native` in dependencies                                | `react-native`        |
| `package.json` with `@capacitor/core` in dependencies                             | `capacitor`           |
| `config.xml` or `package.json` with `cordova` in dependencies                     | `cordova`             |
| `build.gradle` or `AndroidManifest.xml` (no Flutter/RN/Cordova/Capacitor signals) | `android`             |
| `*.xcodeproj` or `Podfile` (no Flutter/RN signals)                                | `ios`                 |
| `package.json` with no mobile framework signals, or `index.html` / `.html` files  | `web` or `iframe-web` |

If a platform is detected with confidence, present it as the pre-selected recommendation:

> "I detected your project is a **[Platform]** app (found `[signal file]`).
>
> Shall I proceed with **[Platform]**?
>
> 1. Yes, use [Platform]
> 2. No, let me choose a different platform"

If the user confirms, skip to disambiguation. If they choose option 2, or if no signal is found, present the full platform list from `$DOC_MAP`.

### Step 2.4 — Disambiguation

Apply after platform is confirmed:

- Android: ask Java vs Kotlin
- iOS: ask Swift vs Objective-C, CocoaPods vs SPM
- Web: if both `web` and `iframe-web` are in the doc map, ask which variant

Store as `$PLATFORM`. Filter `$DOC_MAP` to the chosen platform's pages.

```
integrate-results set platform $PLATFORM
integrate-results set nativeSdkRequired true
integrate-results step-end passed "platform confirmed: $PLATFORM; doc map filtered to platform pages"
```

Flip `platform-detect` task to `completed`.

**Seed Wave 2 dynamic tasks** (in parallel, single turn):

- `{$PLATFORM}-setup` (e.g., `react-native-setup`) — create `TaskCreate` with the resolved platform name
- `checklist` — always

### If `hybrid`

Ask first:

> "This product has both a backend API and a client SDK. What do you need?
>
> 1. **Backend API only**
> 2. **Client SDK only**
> 3. **Both**"

Then follow the `api-only` path if option 1 was selected, the `sdk` path if option 2, or both paths sequentially if option 3.

```
integrate-results set platform $PLATFORM
integrate-results set nativeSdkRequired <true|false>
integrate-results step-end passed "hybrid product; mode=$MODE; platform=$PLATFORM"
```

Flip `platform-detect` task to `completed`.

**Seed Wave 2 dynamic tasks** (in parallel, single turn):

- `{$PLATFORM}-setup` — if `$PLATFORM` is mobile (android/ios/react-native/flutter/cordova/capacitor)
- `checklist` — always

---

## PHASE 3 — Doc Fetch

Run: `integrate-results step-start doc-fetch` | flip `doc-fetch` task to `in_progress`

**Always use `doc_fetch_tool`. Only fall back to WebFetch if MCP returns an explicit error on a valid URL.**

```
juspay-docs-mcp:doc_fetch_tool({ url: "<md content link from $DOC_MAP>" })
```

Fetch order:

1. Pre-Requisites / Overview — always first; defines credentials, auth format, version constraints
2. Numbered base integration pages — in exact numbered order from `explore_product`
3. Webhooks, Order Status API
4. Error Codes (resources section)
5. Advanced sections — only if user asks

While reading each page, extract and store:

- `$CONSTRAINTS` — per-field structured table (replaces the old `$PARAMS` list). For every request field, method param, or constructor arg found:
  - `name` — exact field name from docs
  - `type` — declared type: `String | Integer | Decimal | Boolean | Array | Object`
  - `required` — `true | false`
  - `maxLength` — integer, from patterns: `"max N chars"`, `"maximum N characters"`, `"up to N"`, `"(max: N)"`
  - `minLength` — integer, from patterns: `"min N chars"`, `"at least N characters"`
  - `minValue` — number, from patterns: `"minimum N"`, `"at least N"`, `"min: N"`, `"minimum amount"`
  - `maxValue` — number, from patterns: `"maximum N"`, `"up to N"`, `"max: N"`
  - `format` — string, from patterns: ISO 4217, E.164, UUID, YYYY-MM-DD, alphanumeric
  - `enumValues` — string[], when doc shows a fixed allowed set (`"one of: X, Y, Z"`, or a table of valid values)
  - `warnings` — string[], callout blocks **near this field's entry**: lines matching `> **Note:**`, `> **Important:**`, `> **Warning:**`, `> ⚠️`, `> 💡`, `**Important**`
  - `errors` — string[], error codes from `$ERROR_CODES` that explicitly reference this field name

- `$CODE_EXAMPLES` — exact method names, class names, key identifiers from the docs
- `$ERROR_CODES` — all status values, error codes, failure reasons (full table: code + meaning + recommended action)
- `$VERSION_CONSTRAINTS` — min SDK version, min language/platform version
- `$WARNINGS` — global warning/note callout blocks not tied to a specific field

```
integrate-results step-end passed "fetched $(count) doc pages; $(count) fields in $CONSTRAINTS; $(count) error codes; $(count) warnings"
```

Flip `doc-fetch` task to `completed`.

---

## PHASE 4 — Parameter Collection

Run: `integrate-results step-start params` | flip `params` task to `in_progress`

Tell the user:

> "I've read the documentation. I'll collect what I need."

### Step 4.1 — Auto-resolve merchant context via MCP

`$MERCHANT_ID`, `$CLIENT_ID`, and `$INTEGRATION_TYPE` were already fetched in Step 1.2 — reuse those values. Do not call `juspay_get_merchant_details()` again.

Always call:

```
juspay-mcp:juspay_get_general_settings()
```

From general settings, extract:

- `$RETURN_URL` — existing return URL if configured (check if non-empty)

**Webhook check — only if the docs require it:** Check whether the fetched documentation (Phase 3, doc-fetch) includes a webhooks section or instructs the merchant to configure a webhook URL. If it does, call:

```
juspay-mcp:juspay_get_webhook_settings()
```

From webhook settings, extract:

- `$WEBHOOK_URL` — existing webhook URL if configured (check if non-empty)
- `$WEBHOOK_EVENTS` — currently subscribed events

If the docs do not mention webhooks, skip the webhook check and configuration entirely.

**If webhooks are required by the docs AND `$WEBHOOK_URL` is empty or not configured:**

First, scan the codebase for an existing webhook handler (e.g. `api/juspay/webhook`, `api/webhook`, `webhooks` route). If one exists, note its path as `$WEBHOOK_PATH`.

**Seed `webhook-config` dynamic task** now:

```
TaskCreate({ name: "webhook-config", description: "Configure webhook URL for payment events" })
integrate-results step-start webhook-config
```

**Fetch dashboard docs** to get accurate navigation and direct links. Call:

```
juspay-docs-mcp:explore_product({ product: "dashboard" })
```

If `explore_product` succeeds, find the page whose title contains "Webhook" or "Settings" and fetch it:

```
juspay-docs-mcp:doc_fetch_tool({ url: "<webhook/settings page URL from explore_product result>" })
```

If `explore_product` fails or returns no result, fall back to:

```
juspay-docs-mcp:list_products({ category: "DASHBOARD" })
```

Pick the dashboard product slug from the result, call `explore_product` on it, then `doc_fetch_tool` on the relevant page. Store the fetched page as `$DASHBOARD_DOCS` — the return URL step reuses it.

From the fetched page extract:
- `$WEBHOOK_DOCS_URL` — the URL of the fetched docs page (for reference)
- `$WEBHOOK_DASHBOARD_NAV` — any dashboard navigation path mentioned in the page (e.g. "Settings → Webhooks")
- `$WEBHOOK_DASHBOARD_LINK` — any direct dashboard deep-link found in the page. If no direct link is found, leave this empty and rely on the navigation instructions.
- `$WEBHOOK_EVENTS_REQUIRED` — standard webhook event names recommended for this product

Ask the user for their deployed base URL (needed to compute the full webhook URL):

> "No webhook URL is configured on your account. Please provide your deployed base URL so I can show you exactly what to set in the dashboard.
>
  > If you don't have a deployed URL yet, you can use `ngrok http <port>` or `cloudflared tunnel` to get a temporary public URL."

Once the user provides a base URL, compute `$CONFIGURED_WEBHOOK_URL` = `<user-provided base URL>` + `/` + `$WEBHOOK_PATH` and present the configuration instructions:

> "**Configure your webhook in the Juspay dashboard:**"

> **URL to set:** `$CONFIGURED_WEBHOOK_URL`
>
> **Navigation:** $WEBHOOK_DASHBOARD_NAV _(from docs)_
> **Direct link:** $WEBHOOK_DASHBOARD_LINK _(if available)_
>
> **Events to enable:**
> - _(list each event from `$WEBHOOK_EVENTS_REQUIRED`)_
>
> 📖 Configuration guide: $WEBHOOK_DOCS_URL
>
> Let me know once you've saved the settings and I'll continue."

Wait for the user to confirm the webhook is configured. Store the confirmed URL as `$WEBHOOK_URL`.

```
integrate-results step-end passed "webhook URL configured manually via dashboard: $WEBHOOK_URL; navigation instructions provided"
```

Flip `webhook-config` task to `completed`.

**If `$RETURN_URL` is empty or not configured:**

First, scan the codebase for an existing return URL page or handler that can receive the Juspay redirect and handle order status response. If one exists, note its path as `$RETURN_PATH`.

**Fetch dashboard settings docs.** If `$DASHBOARD_DOCS` is already set from the webhook step above, reuse it. Otherwise call:

```
juspay-docs-mcp:explore_product({ product: "dashboard" })
```

find the general settings page, and fetch it with `doc_fetch_tool`. Fall back to `list_products({ category: "DASHBOARD" })` if `explore_product` fails.

From the fetched page extract:
- `$SETTINGS_DOCS_URL` — URL of the fetched docs page
- `$SETTINGS_DASHBOARD_NAV` — navigation path for general settings (e.g. "Settings → General")
- `$SETTINGS_DASHBOARD_LINK` — direct dashboard deep-link if available

Ask the user for the return URL:

> "No return URL is configured for your account. Please provide the URL customers should be redirected to after payment completes. This must be a real route in your app that handles the payment return/order status response."

After the user provides a URL, validate that it matches an existing route or handler in the codebase. If it does not match, warn:

> "The URL you provided does not appear to exist in the current codebase as a return handler. Are you sure you want to use this?"

Once confirmed, present the configuration instructions:

> "**Configure your return URL in the Juspay dashboard:**
>
> **URL to set:** `<user-provided URL>`
>
> **Navigation:** $SETTINGS_DASHBOARD_NAV _(from docs)_
> **Direct link:** $SETTINGS_DASHBOARD_LINK _(if available)_
>
> 📖 Configuration guide: $SETTINGS_DOCS_URL
>
> Let me know once you've saved the settings."

Wait for the user to confirm. Store the confirmed URL as `$RETURN_URL`.

**Environment is always production.** Do not ask the user. Use production host URLs from the docs.

### Step 4.2 — Auto-provision API key

Do not ask the user for an API key. Instead, call:

```
juspay-mcp:juspay_create_api_key({ description: "integrate-skill-<product>-<date>" })
```

Store the returned plaintext value as `$API_KEY` **in memory only — never log it, never store it in the results file, never echo it**. Inform the user:

> "A new API key has been created for your account for this integration."

**Never display the key value to the user. Never pass it to `integrate-results`.**

### Step 4.3 — Collect remaining required params

Ask in order:

1. **Required params** — each required field the user must supply (skip auto-generated fields and anything already resolved: $MERCHANT_ID, $CLIENT_ID, $API_KEY, $WEBHOOK_URL)
2. **Platform version check** (SDK path only) — if docs specify a minimum version
3. **Backend language** — if not already detected from codebase

### Step 4.4 — Resolve backend base URL and webhook auth credentials

**`$BACKEND_BASE_URL`** — scan the codebase for the backend's listening port and base URL:

| Signal                                                                            | Derived value           |
| --------------------------------------------------------------------------------- | ----------------------- |
| `PORT=XXXX` in backend `.env` or `.env.local`                                     | `http://localhost:XXXX` |
| `EXPO_PUBLIC_API_URL` / `VITE_API_URL` / `NEXT_PUBLIC_API_URL` in frontend `.env` | use that value directly |
| `--port XXXX` in `package.json` dev script                                        | `http://localhost:XXXX` |
| `ports: - "XXXX:XXXX"` in `docker-compose.yml`                                    | `http://localhost:XXXX` |

If detected with confidence, confirm in one line, e.g.:

> "Backend detected at `http://localhost:3001` (from `backend/.env: PORT=3001`)."

If not determinable, ask:

> "What URL is your backend running on? (e.g., `http://localhost:3001`)"

Store as `$BACKEND_BASE_URL`.

**`$WEBHOOK_AUTH_USERNAME` / `$WEBHOOK_AUTH_PASSWORD`** — if the webhook handler uses Basic Auth (check the generated code or backend `.env`), read these values from `.env` rather than asking. Store them **in memory only**. Never log them or include them in step verification strings.

**Sandbox note:** The test scripts in Step 8.2 call your local backend, which in turn calls Juspay's API with your configured credentials. To test with Juspay's Dummy PG (simulator), no extra setup is needed — the test resources page (fetched in Step 8.3.1) lists test cards and UPI VPAs that route to the simulator automatically.

```
integrate-results step-end passed "webhook configured: $WEBHOOK_URL; return URL set; API key provisioned; backend URL: $BACKEND_BASE_URL"
```

Flip `params` task to `completed`.

---

## PHASE 5 — Code Generation

Run: `integrate-results step-start codegen` | flip `codegen` task to `in_progress`

**Rules:**
- Use code examples and method names from fetched docs as the base. Substitute collected values. Do not use method or class names you did not see in the docs.
- Every visible, non-disabled stage in `$INTEGRATION_STAGES` (Step 5.1) must have corresponding code coverage. Cover critical stages first.
- Every constrained field in `$CONSTRAINTS` (Phase 3) must pass through the validation layer before it reaches the API. No parameter bypasses its documented bounds.
- **Before generating frontend/SDK code**, re-read `products/$PRODUCT.md` for any platform-specific or integration-type-specific code instructions. Every such instruction section must be applied exactly as written when generating code for the matching platform or integration type.

### Step 5.1 — Fetch integration stages

Call `juspay_integration_monitoring_status` to discover which payment flows Juspay expects this integration to cover. The result becomes `$INTEGRATION_STAGES` — a second constraint source that drives codegen alongside `$CONSTRAINTS` from Phase 3.

```
juspay-mcp:juspay_integration_monitoring_status({
  platform: <$PLATFORM mapped below>,
  product_integrated: <$PRODUCT mapped below>,
  merchant_id: $MERCHANT_ID,
  start_time: <30 days ago in YYYY-MM-DDTHH:MM:SSZ>,
  end_time: <now in YYYY-MM-DDTHH:MM:SSZ>
})
```

**Product mapping for `product_integrated`:**

| $PRODUCT | product_integrated |
| --- | --- |
| hyper-checkout | Payment Page Session |
| ec-headless | EC + SDK |
| ec-api | EC Only |
| *(others)* | Payment Page Session |

**Platform mapping for `platform`:**

| $PLATFORM | platform |
| --- | --- |
| web, iframe-web | Web |
| android | Android |
| ios | IOS |
| flutter, react-native, cordova, capacitor | Android |
| api-only products | Backend |

**Traversal path** — the response is nested; walk it as follows:

```
queryData.responseData.features
  → each {featureKey}          (e.g., "base")
    → .sections
      → each {sectionKey}      (e.g., "Payments Flow Checklist", "SDK Flow Checklist", "Latency")
        → .stages
          → each {stageKey}    (e.g., "new_card_txn", "upi_collect_txn")
```

For every stage reached by this walk, include it in `$INTEGRATION_STAGES[]` if:
- `visibilityResult === true`
- `disableStage === false`
- `onlyReportResult === false` (reporting-only stages don't need code coverage — skip them)

Each entry in `$INTEGRATION_STAGES[]` stores:

| Field | Source | Notes |
| --- | --- | --- |
| `section` | `{sectionKey}` | dict key, e.g. `"Payments Flow Checklist"` — this IS the display name |
| `stageKey` | `{stageKey}` | dict key, e.g. `"new_card_txn"` |
| `stageDisplayName` | `stage.stageDisplayName` | human name, e.g. `"New Card"` |
| `stageDescription` | `stage.stageDescription` | what to test |
| `criticalResult` | `stage.criticalResult` | boolean — critical stages gate go-live |
| `status` | `stage.status` | `"PASSED"` \| `"FAILED"` \| `"NOT_ATTEMPTED"` — baseline for Step 8.5 diff |

Also store `queryData.scoreData` as `$SCORE_BASELINE`:
- `baseCriticalSuccessCount` / `baseCriticalTotalCount` — e.g. `4 / 8`
- `baseTotalSuccessCount` / `baseTotalCount` — e.g. `4 / 12`

**These stages are the integration contract.** Every stage in `$INTEGRATION_STAGES` must have corresponding code coverage in the steps below. Stages where `criticalResult: true` must be covered before non-critical ones.

### Step 5.2 — Emit validation layer from $CONSTRAINTS

Before writing any integration code, generate a validation helper/function derived from `$CONSTRAINTS`:

- For each field with `maxLength`: add a length check that throws/returns an error if the value exceeds it. Add a `// docs: max N chars` inline comment.
- For each field with `minValue`: add a numeric floor check with a `// docs: min N` comment.
- For each field with `type = Integer` or `Decimal`: enforce correct type casting; never pass a string where the docs declare numeric.
- For each field with `enumValues`: define a constant set (enum, frozen object, or literal union type) and reference it instead of raw strings.
- For each field where `warnings` is non-empty: add a `// ⚠️ WARNING: <warning text>` comment before that field's assignment.

This validation layer is written once and referenced throughout the integration code.

### Step 5.3 — Install SDK dependencies (SDK / hybrid products only)

Before writing any code that imports the SDK, install the packages the docs require.
Use the exact package names and versions stated in the Prerequisites / Getting Started page — do not install anything not mentioned there.

| Platform                               | Command                                      |
| -------------------------------------- | -------------------------------------------- |
| `react-native`, `cordova`, `capacitor` | `npm install <packages>` in the project root |
| `flutter`                              | `flutter pub add <packages>`                 |
| Native Android                         | Add to `build.gradle` `dependencies` block   |
| Native iOS                             | Add to `Podfile` then run `pod install`      |

Generate in order:

1. **Auth / credentials setup** — use environment variables, never hardcode values
2. **Core integration** — API call or SDK install → init → open → response handler
3. **Webhook handler** — if docs have a webhooks section; include signature verification
4. **Status verification utility** — if docs have a status/order API
5. **DB schema** — Follow this flow strictly; do not write or suggest schema changes without completing every step:

   **Step 5.4 — Scan for existing schemas**

   Search the codebase for payment- or order-related DB definitions:
   - Migration files (`migrations/`, `db/migrate/`, `*.sql`, `*.prisma`, `schema.rb`, `typeorm/*.entity.*`, `mongoose` model files, etc.)
   - ORM model files that contain fields like `order_id`, `payment_status`, `transaction_id`, `amount`, or similar

   Collect every match as `$EXISTING_SCHEMAS`.

   **Step 5.5 — Branch on findings**

   _If `$EXISTING_SCHEMAS` is non-empty:_

   Present a summary of what was found:

   > "I found existing payment/order-related schemas:
   >
   > - `<file>`: `<table/model name>` — fields: `<list relevant fields>`
   > - _(repeat for each)_
   >
   > Would you like me to:
   >
   > 1. **Extend these** — add Juspay-specific fields (`juspay_order_id`, `payment_status`, etc.) to the existing schema
   > 2. **Create a separate table** — add a new `juspay_orders` table alongside the existing ones
   > 3. **Skip DB changes** — I'll handle order correlation in the application layer only"

   Wait for a selection. Apply only what the user confirms.

   _If `$EXISTING_SCHEMAS` is empty:_

   Ask permission before creating anything:

   > "No existing payment or order schemas found. The docs require storing: `<fields derived from $PARAMS and the product's status/webhook docs>`.
   >
   > Shall I create a DB schema for this? If yes, which format?
   >
   > 1. Raw SQL migration
   > 2. Prisma schema
   > 3. TypeORM entity
   > 4. Mongoose model
   > 5. Skip — I'll handle this manually"

   Wait for a selection. If the user picks 1–4, generate the schema using field names and constraints from the fetched docs. If they pick 5, skip entirely.

   **Step 5.6 — Generate the agreed schema**

   **Seed `db-schema` dynamic task** now (user confirmed DB changes are needed):

   ```
   TaskCreate({ name: "db-schema", description: "Create/migrate payment schema" })
   integrate-results step-start db-schema
   ```

   Use field names, lengths, and constraints from `$CONSTRAINTS` (not `$PARAMS`) and the product's order/webhook docs. Apply `maxLength` values from `$CONSTRAINTS` as column size constraints (e.g., `VARCHAR(20)` for a field with `maxLength: 20`). Do not add fields that don't appear in the docs or that the user didn't request.

   ```
   integrate-results step-end passed "db schema generated: <table/model name>; N columns; constraints from $CONSTRAINTS applied"
   ```

   Flip `db-schema` task to `completed`.

6. **Error handling** — use error codes from the docs to show how to handle different cases

```
integrate-results step-end passed "code generated: auth setup, core integration, webhook handler, status utility, DB schema; packages installed"
```

Flip `codegen` task to `completed`.

---

## PHASE 6 — Native SDK Setup (Mobile Platforms Only)

**Trigger**: `$PRODUCT_TYPE` is `sdk` or `hybrid` AND `$PLATFORM` is any of: `android`, `ios`, `react-native`, `flutter`, `cordova`, `capacitor`.

The step name is the platform-specific dynamic name seeded in Wave 2: `{$PLATFORM}-setup` (e.g., `react-native-setup`, `android-setup`).

**If NOT triggered**, the handling depends on whether `{$PLATFORM}-setup` was seeded in Phase 2:

**Case A — Task was NOT seeded** (`$PRODUCT_TYPE = api-only`, or `$PRODUCT_TYPE = hybrid` with a non-mobile platform such as `web` or `iframe-web`):
No lifecycle calls are needed — the step was never registered. Skip directly to Phase 7.

**Case B — Task WAS seeded but native setup is not applicable** (`$PRODUCT_TYPE = sdk` on a non-mobile platform such as `web` or `iframe-web`, where the docs show no native SDK setup is needed):

```
integrate-results step-start {$PLATFORM}-setup
integrate-results step-end skipped "not applicable: $PLATFORM is not a native mobile platform; no native SDK setup required"
```

Flip `{$PLATFORM}-setup` task to `completed`. Skip to Phase 7.

---

Run: `integrate-results step-start {$PLATFORM}-setup` | flip `{$PLATFORM}-setup` task to `in_progress`

**Rule**: Every action in this phase is grounded in the docs fetched in Phase 3. Do not invent steps.

### Step 6.1 — Extract native setup requirements from docs

Re-scan the pages already fetched in Phase 3 (Prerequisites / Overview / Getting Started, plus any "Android Setup" or "iOS Setup" named sections) and extract:

- `$NATIVE_PACKAGES` — packages/dependencies to install (npm/pub/gradle/cocoapods)
- `$BUILD_TOOL_CHANGES` — edits required to build config files (`build.gradle`, `pubspec.yaml`, etc.)
- `$PLATFORM_CONFIG_FILES` — config files that must be created (e.g. a `*.txt` or `*.json` with SDK credentials)
- `$POST_INSTALL_SCRIPTS` — scripts that must run after package install (e.g. Podfile hooks, asset fuse scripts)
- `$PREBUILD_REQUIRED` — whether a prebuild/generate/sync step is needed before native directories are accessible

If a docs section is explicitly labelled "Android Setup" or "iOS Setup", treat its full contents as authoritative for that platform — do not skip any step it lists.

### Step 6.2 — Check project structure

Detect the project workflow from the codebase before running anything:

| Signal                                                     | Workflow                                     |
| ---------------------------------------------------------- | -------------------------------------------- |
| `app.json` with `"expo"` key, no `android/` or `ios/` dirs | Expo managed — native dirs must be generated |
| `android/` and `ios/` present                              | Bare / native — no prebuild needed           |
| `pubspec.yaml`                                             | Flutter — use Flutter toolchain              |
| `config.xml`                                               | Cordova — use `cordova platform add`         |
| `capacitor.config.*`                                       | Capacitor — use `npx cap sync`               |

For managed workflows where native directories do not yet exist: run the framework's generate/sync command (e.g. `npx expo prebuild` for Expo managed, `npx cap sync` for Capacitor, `flutter pub get` for Flutter) **only if `$PREBUILD_REQUIRED` is true or the framework mandates it**. Never run a destructive generate command on a repo that already has native directories.

### Step 6.3 — Execute build tool changes

For each item in `$BUILD_TOOL_CHANGES`:

- Read the target file first.
- Apply the change using the Edit tool (not shell sed/awk) so the diff is reviewable.
- Check idempotency — if the value is already present, skip it.

### Step 6.4 — Create platform config files

For each item in `$PLATFORM_CONFIG_FILES`:

- Write the file using the Write tool.
- Substitute `$CLIENT_ID`, `$MERCHANT_ID`, or any other resolved credential from Phase 4.

### Step 6.5 — Run post-install scripts and dependency sync

For each item in `$POST_INSTALL_SCRIPTS`:

- Run via Bash.
- Capture stdout/stderr; if it exits non-zero, read the error, diagnose, fix, and re-run.
- Do not continue to the next step until this one exits 0.

### Step 6.6 — Summary table

Report results before recording the step:

```
## Native SDK Setup Complete

| Step | Action | Result |
|------|--------|--------|
| packages installed | <names from docs> | ✅ / ❌ |
| prebuild / generate | <command, or "skipped — dirs existed"> | ✅ / skipped / ❌ |
| build config patched | <files changed> | ✅ / ❌ |
| config files created | <files created> | ✅ / ❌ |
| post-install scripts | <commands run> | ✅ / ❌ |
```

Any ❌ row must include the captured error output and the fix attempted.

```
integrate-results step-end passed "{$PLATFORM}-setup complete: packages installed, build configs patched, config files created, post-install scripts run"
```

Flip `{$PLATFORM}-setup` task to `completed`.

---

## PHASE 7 — Checklist and Error Reference

`checklist` was seeded as a dynamic task in Wave 2 (after Phase 2, platform-detect). Flip it to `in_progress` now.

Run: `integrate-results step-start checklist` | flip `checklist` task to `in_progress`

### Checklist

Generate a checklist from what you actually fetched — every item must reflect something real in this product's docs.

````
## Integration Checklist — [Product] on [Platform or API]

### Credentials
- [ ] [credential from docs] stored as env var
- [ ] API key generated via dashboard or juspay-mcp

### [Backend / API]
[items derived from API doc pages]

### [Frontend / SDK] (if applicable)
[items derived from SDK doc pages]

### Testing
- [ ] Successful sandbox transaction
- [ ] Error case from $ERROR_CODES tested
- [ ] Webhooks verified end-to-end

### Integration Stages (from Juspay)

`$INTEGRATION_STAGES` was already fetched in Step 5.1 — render it directly, no second MCP call needed here.

For each stage in `$INTEGRATION_STAGES`, emit:

```
### [stage.section]   ← the section dict key is the display name, e.g. "Payments Flow Checklist"

- [ ] **[stage.stageDisplayName]** ⚠️ Critical ← only if stage.criticalResult is true
      [stage.stageDescription]
```

- Do **not** show `status` — it reflects past activity, not a live gate; developers check stages off as they test
- Mark stages where `criticalResult: true` as ⚠️ Critical
- Group stages by `stage.section` (the section dict key)

### Go-Live
- [ ] Switched to production environment and keys
- [ ] Production end-to-end test passed
````

### Parameter Constraints

Emit this table only for fields in `$CONSTRAINTS` where at least one constraint column is non-null. Omit fully unconstrained fields to keep it scannable.

```
## Parameter Constraints

| Field | Type | Required | Max Length | Min Value | Format | Warnings |
|-------|------|----------|------------|-----------|--------|---------|
[one row per constrained field from $CONSTRAINTS — populate only non-null columns; use — for nulls]
```

### Error Reference

```
## Error Codes

| Code / Status | Meaning | Recommended action |
|---------------|---------|-------------------|
[from $ERROR_CODES]
```

### What's next

Briefly offer to go deeper on sections from `$DOC_MAP` that weren't part of the base integration — but only mention things you actually saw in the doc map.

```
integrate-results step-end passed "checklist generated from docs; $(count) integration stages from monitoring API; error reference table built"
```

Flip `checklist` task to `completed`.

---

## PHASE 8 — Live Testing

Run: `integrate-results step-start test` | flip `test` task to `in_progress`

**Always attempt to run the server and test the integration yourself. Do not tell the user to test manually if you can do it.**

### Step 8.1 — Start the dev server

Scan the codebase for the start command:

| Signal                              | Command                       |
| ----------------------------------- | ----------------------------- |
| `package.json` with `"dev"` script  | `npm run dev` (or `yarn dev`) |
| `pubspec.yaml`                      | Cannot run — skip to Step 8.3 |
| Mobile-only project (no web server) | Cannot run — skip to Step 8.3 |

**Before starting** the server, call:

```
integrate-results set active waiting
```

Run the server in the background, wait for it to be ready, then:

```
integrate-results set active working
```

> **Important:** Shell environment variables override `.env` files in Vite/Node. Before starting the server, check if any required env vars (e.g. `JUSPAY_API_KEY`) are already set in the shell and would conflict with the project's `.env`. Unset them if they don't belong to this project.

### Step 8.2 — Run backend API tests

If the product file (in `products/$PRODUCT.md`) defines a `## Test Scripts` section, use those scripts for Steps 8.2.2 and 8.2.3 — the exact invocation, arguments, and verification criteria are specified there. Each script prints the HTTP status, response body, and an explicit ✅ / ❌. If a script exits non-zero, read the output, diagnose the root cause (wrong env var, bad header, type mismatch, server log), fix, and re-run until it passes.

If no product-specific test scripts are defined, test Steps 8.2.2 and 8.2.3 with inline curl against `$SESSION_ENDPOINT` and `$ORDER_STATUS_ENDPOINT`.

**SECURITY: Pass credentials to test scripts via exported env vars, not inline in the command string.**

```bash
export JUSPAY_API_KEY="$API_KEY"  # set in env, do not inline in command
```

**Step 8.2.1 — Generate test parameters**

Auto-generate these — do not ask the user:

- `TEST_ORDER_ID` = `test-$(date +%s)` (unique per run)
- `TEST_AMOUNT` = `1.00`
- `TEST_CUSTOMER_ID` = `test-customer-001`
- `TEST_CUSTOMER_EMAIL` = `test@juspay.in`
- `TEST_CUSTOMER_PHONE` = `9999999999`
- `TEST_FIRST_NAME` = `Test`, `TEST_LAST_NAME` = `User`
- `FAIL_ORDER_ID` = `fail-$(date +%s)` (separate ID for the failure-case webhook test)

Derive endpoint URLs from the generated backend routes and `$BACKEND_BASE_URL`:

- `SESSION_ENDPOINT` = `$BACKEND_BASE_URL` + session route (e.g. `/api/juspay/session`)
- `ORDER_STATUS_ENDPOINT` = `$BACKEND_BASE_URL` + order-status route prefix (e.g. `/api/juspay/order-status`)
- `WEBHOOK_ENDPOINT` = `$BACKEND_BASE_URL` + webhook route (e.g. `/api/juspay/webhook`)

**Step 8.2.2 — Session creation**

Run the session test as specified in the product file's `## Test Scripts` section (if defined), or use inline curl to POST to `$SESSION_ENDPOINT` with the test parameters from Step 8.2.1.

**Step 8.2.3 — Order status**

Run the order-status test as specified in the product file's `## Test Scripts` section (if defined), or use inline curl to GET `$ORDER_STATUS_ENDPOINT/$TEST_ORDER_ID`.

**Step 8.2.4 — Webhook tests (inline curl)**

Webhook tests use inline curl since payload structure and event names vary per product — derive both from the webhook section of the docs fetched in Phase 3:

```bash
# SUCCESS — credentials passed via env, not inline
curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(printf '%s:%s' "$WEBHOOK_AUTH_USERNAME" "$WEBHOOK_AUTH_PASSWORD" | base64)" \
  -d '<payload constructed from docs — substitute $TEST_ORDER_ID and $TEST_JUSPAY_ORDER_ID>'
```

Assert: HTTP 200 AND body contains `{"status":"ok"}` AND DB row `payment_status` = success status from docs.

Repeat for the failure event type using `$FAIL_ORDER_ID` (create a session for it first with `test-session.sh`).

Assert: HTTP 200 AND DB row `payment_status` = failure status from docs.

**Step 8.2.5 — Constraint edge-case tests (inline curl)**

For each field in `$CONSTRAINTS` where `maxLength`, `minValue`, or `type` is defined, generate one boundary test. Only test fields that are part of a backend API request (skip client-only SDK fields):

- **maxLength test**: send the field with a value of exactly `maxLength + 1` characters → expect the doc-specified error code for that field (from `$CONSTRAINTS[field].errors`). Assert HTTP 4xx AND response body contains expected error code.
- **minValue test**: send the field with value `minValue - 1` → expect the doc-specified error. Assert HTTP 4xx AND expected error code in body.
- **type test**: send a string where `type = Integer` or `Decimal` → expect the doc-specified error. Assert HTTP 4xx AND expected error code in body.
- **enumValues test**: send a value not in `enumValues` → expect rejection. Assert HTTP 4xx.

Report in Step 8.4 table with type `Constraint`.

### Step 8.3 — Frontend / SDK tests

**This step applies when `$PRODUCT_TYPE = sdk` or `$PRODUCT_TYPE = hybrid`.**

**Step 8.3.1: Fetch test credentials** (all SDK/hybrid products)

```
juspay-docs-mcp:doc_fetch_tool({ url: "<test-resources md content link from $DOC_MAP>" })
```

Extract:

- `$TEST_CARDS` — card numbers, expiry, CVV for the Dummy PG / simulator
- `$TEST_UPI_VPA` — VPA values for UPI success/failure (e.g. `success@upi`, `failure@upi`)
- `$DUMMY_PG_FLOWS` — how to trigger success vs failure for each payment method on the simulator

**Step 8.3.2: Branch on platform**

#### Web / iframe-web

The integration checklist stages (New Card, UPI Collect, UPI Intent, Wallet, etc.) are registered on Juspay's servers only when real transactions flow through the hosted payment page. For each stage:

- Navigate to the payment page URL from the session response
- Complete a transaction using `$TEST_CARDS` / `$TEST_UPI_VPA`
- Verify the callback / redirect lands on `$RETURN_URL`
- If the payment page blocks headless browsers or requires CAPTCHA, state this explicitly — do not silently skip

#### Mobile (react-native, flutter, android, ios, cordova, capacitor)

The SDK UI runs on a device/emulator and cannot be driven from the CLI. State this explicitly before providing the guide:

> "Backend tests (Step 8.2) are complete. The client-side SDK requires manual verification on a device or emulator."

Produce a ready-to-run manual test guide from `$TEST_CARDS`, `$TEST_UPI_VPA`, `$DUMMY_PG_FLOWS`, and the integration stages from the Phase 7 checklist:

```
## Manual SDK Test Guide

### Setup
- Build and install: `npx expo run:android` / `npx expo run:ios` / `flutter run` / etc.
- Backend must be running at: $BACKEND_BASE_URL

### Test flows

| # | Flow | Test input | Expected result |
|---|------|------------|-----------------|
| 1 | New Card — success | [success card from $TEST_CARDS] | Payment succeeds, app shows success |
| 2 | New Card — failure | [decline card from $TEST_CARDS] | Payment fails, error shown gracefully |
| 3 | UPI Collect — success | [success VPA from $TEST_UPI_VPA] | UPI request sent, payment succeeds |
| 4 | UPI Collect — failure | [failure VPA from $TEST_UPI_VPA] | Failure handled gracefully |
| 5 | Back / cancel | Tap hardware/software back on payment screen | App returns to checkout, no order corruption |
| [other stages from Phase 7 checklist] | | | |

### After each test
- DB: verify `payment_status` updated (via webhook)
- App: success/failure screen matches the payment outcome
```

### Step 8.4 — Report results

After all testing, report a unified pass/fail table:

```
| Test | Type | Result |
|------|------|--------|
| POST {session endpoint} → sdkPayload + DB row | Backend | ✅ / ❌ |
| GET {order-status endpoint} → status field | Backend | ✅ / ❌ |
| POST {webhook endpoint} <success event> → DB updated | Backend | ✅ / ❌ |
| POST {webhook endpoint} <failure event> → DB updated | Backend | ✅ / ❌ |
| {field} maxLength exceeded → {expected error code} | Constraint | ✅ / ❌ / — |
| {field} below minValue → {expected error code} | Constraint | ✅ / ❌ / — |
| {field} wrong type → {expected error code} | Constraint | ✅ / ❌ / — |
| New Card — success | Web / ⏭ manual on device | ✅ / ❌ / ⏭ |
| New Card — failure | Web / ⏭ manual on device | ✅ / ❌ / ⏭ |
| UPI Collect — success | Web / ⏭ manual on device | ✅ / ❌ / ⏭ |
| UPI Collect — failure | Web / ⏭ manual on device | ✅ / ❌ / ⏭ |
| [other stages from Phase 7] | Web / ⏭ manual on device | ✅ / ❌ / ⏭ |
```

— = no constraint-testable fields found for this category; Constraint rows are expanded once per constrained field.

⏭ = not automatable from CLI; manual test guide provided in Step 8.3.2.

If any automated test cannot be completed (payment page blocks headless, CAPTCHA, etc.), state the reason explicitly — never silently mark as passed.

```
integrate-results set active working
integrate-results step-end passed "backend tests: session ✅ order-status ✅ webhook-success ✅ webhook-failure ✅; SDK: manual guide provided"
```

### Step 8.5 — Confirm integration stages

Call `juspay_integration_monitoring_status` again with the same arguments as Step 5.1 to verify that test activity has been recorded against the merchant account:

```
juspay-mcp:juspay_integration_monitoring_status({
  platform: <same mapping as Step 5.1>,
  product_integrated: <same mapping as Step 5.1>,
  merchant_id: $MERCHANT_ID,
  start_time: <30 days ago in YYYY-MM-DDTHH:MM:SSZ>,
  end_time: <now in YYYY-MM-DDTHH:MM:SSZ>
})
```

Walk the same traversal path as Step 5.1 and compare `status` for each `stageKey` against the baseline in `$INTEGRATION_STAGES`. Also compare the new `queryData.scoreData` against `$SCORE_BASELINE`.

Report a diff table — one row per stage from `$INTEGRATION_STAGES`:

```
## Integration Stage Confirmation

| Stage | Section | Critical | Before | After | Change |
| ----- | ------- | -------- | ------ | ----- | ------ |
| [stageDisplayName] | [section] | ⚠️ / — | [baseline status] | [new status] | ✅ / ⚠️ / ❌ |
```

- **Before / After** values: `PASSED` | `FAILED` | `NOT_ATTEMPTED`
- **Change** column:
  - ✅ — status moved to `PASSED` (was `NOT_ATTEMPTED` or `FAILED`)
  - ⚠️ — no change in status
  - ❌ — status regressed (was `PASSED`, now `FAILED` or `NOT_ATTEMPTED`)

Below the table, print the score delta:

```
Critical stages: [new baseCriticalSuccessCount] / [baseCriticalTotalCount] passing
                 (was [baseline baseCriticalSuccessCount] / [baseCriticalTotalCount])
All stages:      [new baseTotalSuccessCount] / [baseTotalCount] passing
```

If any critical stage (`criticalResult: true`) is still `NOT_ATTEMPTED` or `FAILED` after testing, flag it as a go-live blocker:

> "⚠️ Stage **[stageDisplayName]** is critical and still not passing. This must be resolved before go-live."

Flip `test` task to `completed`.

---

## PHASE 9 — Integration Summary

Run: `integrate-results step-start summary` | flip `summary` task to `in_progress`

Write a persistent, developer-facing summary of every change made during this integration run. This file is the single place a future developer can look to understand what was added, what was configured, and what to expect from the integration.

### Step 9.1 — Locate or create the summary directory

Scan the project root for existing documentation or notes directories in this priority order:

| Found at root         | Write to                              |
| --------------------- | ------------------------------------- |
| `docs/` exists        | `docs/juspay-integration/`            |
| `memory-bank/` exists | `memory-bank/juspay-integration/`     |
| `notes/` exists       | `notes/juspay-integration/`           |
| None of the above     | `juspay-integration/` at project root |

Create the chosen directory if it does not already exist. Name the file `[product]-[YYYY-MM-DD].md` (e.g., `hyper-checkout-2026-05-25.md`). If a file with that name already exists from a prior run, append a counter suffix (`-2`, `-3`, …) rather than overwriting it.

### Step 9.2 — Write the summary file

Use the Write tool to create the file. Populate each section from what was actually performed during this workflow run — **omit any section where no changes were made**. Never fabricate rows.

```markdown
# Juspay Integration Summary — [Product] on [Platform or API]

**Date:** [YYYY-MM-DD]  
**Merchant ID:** [MERCHANT_ID]  
**Docs base:** [first page URL from $DOC_MAP, for reference]

---

## Environment Variables

Variables added to `.env` or `.env.local` during this integration (names only — never values).

| Variable                            | File | Purpose                     |
| ----------------------------------- | ---- | --------------------------- |
| JUSPAY_API_KEY                      | .env | API authentication          |
| JUSPAY_MERCHANT_ID                  | .env | Merchant account identifier |
| JUSPAY_CLIENT_ID                    | .env | SDK client identifier       |
| JUSPAY_WEBHOOK_USERNAME             | .env | Webhook Basic Auth username |
| JUSPAY_WEBHOOK_PASSWORD             | .env | Webhook Basic Auth password |
| [any others written during codegen] |      |                             |

---

## API Routes Created / Modified

| Method | Path | File | Description |
| ------ | ---- | ---- | ----------- |

[one row per route generated in Phase 5 — e.g., POST /api/juspay/session, GET /api/juspay/order-status/:orderId, POST /api/juspay/webhook]

---

## Database Changes

| Change | Table / Model | Migration file | Columns added / modified |
| ------ | ------------- | -------------- | ------------------------ |

[one row per table or model created or altered in Phase 5 DB work]

---

## Order / Payment Status Mapping

Juspay statuses mapped to app-internal statuses in the webhook handler and order-status utility.

| Juspay status | App status | Mapped in |
| ------------- | ---------- | --------- |

[rows derived from status values used in the generated webhook handler and order-status code]

---

## Frontend Routes / Pages

| Route | File | Description |
| ----- | ---- | ----------- |

[rows for any frontend pages, redirect handlers, or return-URL routes created in Phase 5]

---

## SDK / Packages Installed

| Package | Version pinned | Platform |
| ------- | -------------- | -------- |

[rows from packages installed in Step 5.3 or Phase 6 — names and versions from the docs]

---

## Config Files Created or Modified

| File | Change type | Notes |
| ---- | ----------- | ----- |

[rows for build configs, platform config files, .env, gradle files, Podfile, pubspec.yaml, etc. touched during the integration]

---

## Webhook Configuration

| Setting           | Value                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| Webhook URL       | [WEBHOOK_URL]                                                                   |
| Events subscribed | [comma-separated list of event names where value is true in the updated config] |

---

## Return URL

[RETURN_URL]

---

## Other-Side TODO _(only present when `$SINGLE_SIDE_MODE = true`)_

> This section is written **only** when Step 2.2.5 detected a single-side codebase and the user chose to continue with one side. Omit it entirely if both sides were present.
>
> **Do not hardcode any steps here.** Every checklist item must be derived from the docs fetched in Phase 3. Walk `$DOC_MAP` for `$MISSING_SIDE`-facing sections (e.g. sections labelled "Backend", "Server", "API" if `$MISSING_SIDE = backend`; sections labelled "Frontend", "Client", "SDK", platform names if `$MISSING_SIDE = frontend`). For each page in those sections, extract the required actions and emit one checklist item per distinct action, using the exact names from `$CODE_EXAMPLES` and `$CONSTRAINTS`.

### What must be implemented on the [$MISSING_SIDE] before go-live

[One checklist item per required action from the $MISSING_SIDE-facing doc sections in $DOC_MAP. Group items under the same section headings used in the docs. Use exact method/field/file names from $CODE_EXAMPLES and $CONSTRAINTS — no invented names.]

---

## Notes

[Non-obvious decisions, workarounds, known caveats, or anything a future developer would need to know. Do not include credential values. Examples: why a particular status mapping was chosen, a version constraint from the docs, a quirk of the SDK init flow, etc.]
```

```
integrate-results step-end passed "summary written to [path]; N env vars, N routes, N DB changes, N status mappings documented"
```

Leave any section empty if no changes were made in that category (e.g., if this product's docs didn't require any environment variables, omit the Environment Variables section entirely rather than writing "None").

Flip `summary` task to `completed`.

---

## ENTRY POINTS

| ID                 | Starts at        | Use case                                           |
| ------------------ | ---------------- | -------------------------------------------------- |
| `default`          | `product-select` | Full integration from scratch                      |
| `--from doc-fetch` | `doc-fetch`      | Re-fetch docs (e.g. after product/platform change) |
| `--from codegen`   | `codegen`        | Regenerate code (docs already fetched)             |
| `--from test`      | `test`           | Re-run live tests only                             |
| `--from summary`   | `summary`        | Re-write the integration summary only              |

When using `--from <step>`, seed the 8 STATIC_STEPS plus any dynamic steps that would have been generated before the entry point (e.g., `--from codegen` on a React Native project also seeds `react-native-setup` and `checklist`). Immediately mark all steps before the entry point as `completed` (back-to-back `step-start` / `step-end passed "resumed from --from flag"`).

---

## DONE

Run: `integrate-results step-start done` | flip `done` task to `in_progress`

### Timing summary

Run the timing summary script:

```
.claude/skills/integrate/scripts/lifecycle/done
```

It emits:

1. A markdown timing table (step, status, duration, verification), with any step taking ≥30% of total time in **bold**.
2. A total wall-clock line.
3. A `**Slowest step**:` line.
4. A `<<<FACTS ... FACTS` block with machine-readable data (`totalSeconds`, `slowestStep`, `dominantSteps`, `skippedSteps`, `failedSteps`, `product`, `platform`, `productType`).

Print the table to the user. Do not compute durations yourself.

### Optimization suggestions

Read the `FACTS` block and generate 2–3 concrete suggestions based on the actual timing:

- If `doc-fetch` dominated: suggest `--from codegen` for re-runs when only regenerating code
- If `test` failed: note which test failed and how to re-run with `--from test` after fixing
- If `{platform}-setup` was slow: note the specific build step and suggest `--from codegen` for re-runs
- If `params` was slow: user interaction was the bottleneck — suggest running with `--product <id> --platform <id>` next time to skip discovery
- If `product-select` + `platform-detect` dominated: suggest `--product <id>` flag for faster re-runs

Be specific to this run's data, not generic advice.

### Completion

```
integrate-results set status completed    # or "failed" if any phase failed without recovery
integrate-results set active false
integrate-results step-end passed "integration complete: $PRODUCT on $PLATFORM; timing table printed"
```

Flip `done` task to `completed`.

`"completed"` requires all steps `passed` or `skipped`. A `failed` step always blocks `"completed"` — call `integrate-results set status failed` instead.

---

## TOOL CALL REFERENCE

| When          | Tool                                        | Purpose                                                                                       |
| ------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Step 1.1      | Read `products/*.md`                        | Load product summaries for intent matching                                                    |
| Step 1.2      | `juspay_get_merchant_details()`             | Auto-resolve merchant ID, client ID, integration type — infer recommended product             |
| Step 1.7      | `explore_product(candidate-id)`             | Probe type and platforms before recommending                                                  |
| Step 2.1      | `explore_product($PRODUCT)`                 | Get full doc structure and page URLs; classify product type                                   |
| Phase 3       | `doc_fetch_tool(url)`                       | Fetch individual doc pages; build `$CONSTRAINTS` table with types, maxLength, minValue, etc.  |
| Step 4.1      | `juspay_get_webhook_settings()`             | Check if webhook URL is already configured                                                    |
| Step 4.1      | `juspay_get_general_settings()`             | Check if return URL is already configured                                                     |
| Step 4.1      | `explore_product("dashboard")`              | Primary: get dashboard doc structure to find webhook/settings pages                           |
| Step 4.1      | `doc_fetch_tool(url)`                       | Fetch the webhook or general-settings page from the dashboard product; store as `$DASHBOARD_DOCS` |
| Step 4.1      | `list_products({ category: "DASHBOARD" })`  | Fallback if `explore_product("dashboard")` fails — find the correct dashboard product slug    |
| Step 4.2      | `juspay_create_api_key(...)`                | Provision a new API key; store in memory only — never log or store in results file            |
| Step 5.1      | `juspay_integration_monitoring_status(...)` | Fetch integration stage contract into `$INTEGRATION_STAGES`; drives which flows codegen must cover |
| Step 8.5      | `juspay_integration_monitoring_status(...)` | Re-call after tests to confirm stage activity recorded; diff against `$INTEGRATION_STAGES` baseline |
| Step 5.2      | (code output)                               | Emit validation layer from `$CONSTRAINTS` — length/value/type guards before API calls         |
| Step 5.3      | Bash                                        | Install SDK packages (npm/flutter/gradle/pod) — names and versions from docs                  |
| Phase 6       | Bash                                        | Run prebuild/generate/sync, run post-install scripts — steps derived from docs                |
| Phase 6       | Edit / Write                                | Patch build config files or create platform config files — content derived from docs          |
| Step 4.4      | Bash / Read                                 | Detect `$BACKEND_BASE_URL` from `.env` / `package.json`; read webhook auth credentials        |
| Step 8.2      | Bash (product test scripts or inline curl)  | POST session endpoint; verify HTTP 200 + product-specific response fields + DB row            |
| Step 8.2      | Bash (product test scripts or inline curl)  | GET order-status endpoint; verify HTTP 200 + status field                                     |
| Step 8.2      | Bash (inline curl)                          | POST synthetic webhook events; payload from docs; assert HTTP 200 + DB updated                |
| Phase 9       | Bash / Read                                 | Detect summary directory (`docs/`, `memory-bank/`, `notes/`, or project root)                 |
| Phase 9       | Write                                       | Write `juspay-integration/[product]-[date].md` with env vars, routes, DB changes, mappings    |
| Startup       | `integrate-results init`                    | Initialize lifecycle skeleton                                                                 |
| Each phase    | `integrate-results step-start/step-end`     | Bookend every phase for timing accuracy                                                       |
| Metadata      | `integrate-results set`                     | Store product/platform/productType/merchantId — never credentials                             |
| Done          | `/scripts/lifecycle/done`                   | Generate timing table + FACTS block                                                           |
| Fallback only | WebFetch                                    | Only if `doc_fetch_tool` returns an error on a valid URL                                      |

**Never construct doc URLs yourself.** All URLs come from the `md content link` field in `explore_product` responses.

---

## Output

Each phase produces structured output in the conversation:

- **Phase 1** — Numbered product recommendation with confirmed `$PRODUCT`
- **Phase 2** — Detected platform confirmation with confirmed `$PLATFORM`
- **Phase 3** — Silent (doc pages fetched; `$CONSTRAINTS`, `$ERROR_CODES`, `$CODE_EXAMPLES` stored)
- **Phase 4** — One-line confirmation per auto-resolved setting; questions only for missing values
- **Phase 5** — Generated code blocks: validation layer, API routes, webhook handler, order-status utility, optional DB schema
- **Phase 6** (mobile only) — Native setup summary table with ✅ / ❌ / skipped per step
- **Phase 7** — Markdown integration checklist + parameter constraints table + error reference table
- **Phase 8** — Unified pass/fail test results table; manual SDK test guide for mobile platforms
- **Phase 9** — Summary file written to `[docs|memory-bank|notes|juspay-integration]/[product]-[YYYY-MM-DD].md`
- **Done** — Timing table with per-phase durations and 2–3 concrete optimization suggestions

---

## GUARDRAILS

1. **No product knowledge in this file.** Product IDs, platform lists, and credential names come from `products/` or MCP responses — never from this file or training data.

2. **Read `products/` before matching intent.** Do not guess which product fits based on training-data familiarity.

3. **Call `explore_product` before recommending.** Step 1.7 is mandatory. You must know the product's type and integration complexity before presenting it as a recommendation.

4. **Never construct doc URLs.** All URLs come from the `md content link` field in `explore_product` responses.

5. **Never fabricate.** If a page didn't load or a section wasn't in the docs, say so. Offer the raw URL for the user to check manually.

6. **Product type comes from `explore_product`.** Do not infer type from the product name or training data.

7. **Platform list comes from `$DOC_MAP`.** Present exactly the platforms that `explore_product` returned — no more, no less.

8. **API-only products never get a platform question.** If `$DOC_MAP` has no runtime platform IDs, skip platform selection entirely.

9. **Code examples come from the docs.** Use the exact method names, class names, and code structure from the fetched documentation pages as your source of truth.

10. **Parameters and constraints come from the docs.** The actual required fields, types, maxLength, minValue, and enumValues are what the fetched pages say — populate `$CONSTRAINTS` from them.

11. **Code uses doc-sourced names only.** If a method or class name doesn't appear in the fetched pages, do not use it.

12. **Error codes come from the docs.** Collect them from every page you fetch. Do not invent them.

13. **Credentials never leave memory.** `$API_KEY`, `$WEBHOOK_AUTH_PASSWORD`, and any other secret must not appear in verification strings, task descriptions, `integrate-results` calls, Bash command arguments, or any terminal output. The `integrate-results` script enforces this for stored fields; the caller is responsible for verification strings and command arguments.
