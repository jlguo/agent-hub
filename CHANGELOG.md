# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cursor-based pagination for message retrieval (`?cursor=msgId&limit=N`)
- `DiscussionParticipant` join model replacing JSON `participants` field
- Semantic color palette in tailwind.config (primary, surface, border, text)
- `data-testid` attributes on key UI elements for reliable E2E testing
- `maxPaginationLimit` configuration with `MAX_PAGINATION_LIMIT` env override
- Data migration script for Discussion participants (`prisma/migrate-discussion-participants.ts`)

### Changed

- **BREAKING:** Unified `AppError`/`ApiError` into single error system with `ErrorCode` enum
- **BREAKING:** Replaced all `console.log/error` with winston logger
- **BREAKING:** Extracted hardcoded constants to `app.config.ts` (env-overridable)
- **BREAKING:** Changed `Discussion.participants` from JSON string to `DiscussionParticipant` relation
- **BREAKING:** Removed deprecated Room session fields (`openclawSessionId`, `sessionMaxAge`, `sessionCreatedAt`)
- Moved `recentMessages` fetch outside for-loop in `triggerAgentResponse` (N+1 query fix)
- Improved `MENTION_COOLDOWNS` with time-based periodic cleanup via `setInterval`
- Removed global `io` export — all code uses `getIO()` from `lib/socket.ts`
- Extracted business logic from messages route to `MessageService`
- Extracted `Sidebar`, `MessageList`, `ChatInput` components with `React.memo`
- Created `useSocket` and `useChat` custom hooks
- Fixed double scroll container — single scroll in MessageList with `min-h-0` flex
- Added thin custom scrollbars (6px) with dark mode support
- Fixed long message wrapping with `break-words` + `overflow-wrap: anywhere`
- Fixed `Dockerfile.backend` for production (multi-stage build, `npm ci --omit=dev`)
- Fixed Docker permissions (`chown` instead of `chmod 777`)
- Increased Vitest coverage thresholds (25% → 40%)
- Added Firefox to Playwright test matrix
- Upgraded CI to Node 20 LTS only

### Fixed

- N+1 query in `MessageService.triggerAgentResponse`
- SQLite test DB path resolution — use absolute paths via `__dirname`
- Parallel worker race condition — override `DATABASE_URL` before dotenv loads
- WebKit screenshot size limit (32767px) with try/catch
- Discussion tests resilience to missing AI backend
- App startup timeout (15s → 30s)
- Scroll position test strict mode violation
- E2E test selectors now use `data-testid` attributes instead of CSS classes

### Migration Guide

#### Database Schema Changes

1. **Discussion.participants** changed from JSON string to `DiscussionParticipant` relation:

   ```bash
   npx prisma migrate dev
   npx tsx prisma/migrate-discussion-participants.ts
   ```

2. **Removed Room session fields** — these were deprecated:
   - `openclawSessionId`
   - `sessionMaxAge`
   - `sessionCreatedAt`

   If your application uses these fields, you'll need to update your code.

#### API Changes

- Error responses now use standardized `ErrorCode` enum values
- Message pagination now supports cursor-based pagination (`?cursor=msgId`)
- Maximum pagination limit is now configurable via `MAX_PAGINATION_LIMIT` (default: 500)

#### Configuration Changes

All previously hardcoded constants are now in `app.config.ts` and can be overridden via environment variables:

| Environment Variable          | Default | Description                            |
| ----------------------------- | ------- | -------------------------------------- |
| `MENTION_COOLDOWN_MS`         | 60000   | Cooldown after @mention                |
| `MENTION_CLEANUP_INTERVAL_MS` | 120000  | Cleanup interval for expired cooldowns |
| `RECENT_MESSAGE_LIMIT`        | 20      | Messages for agent context             |
| `FOLLOWUP_MESSAGE_LIMIT`      | 15      | Messages for @mention followup         |
| `DEFAULT_PAGINATION_LIMIT`    | 200     | Default pagination limit               |
| `MAX_PAGINATION_LIMIT`        | 500     | Maximum pagination limit               |
| `AGENT_RESPONSE_DELAY_MIN_MS` | 2000    | Min delay between agent responses      |
| `AGENT_RESPONSE_DELAY_MAX_MS` | 1000    | Max additional random delay            |
| `BASE_RESPONSE_PROBABILITY`   | 0.6     | Base probability of agent responding   |

#### Frontend Changes

- Components now use `data-testid` attributes for E2E testing:
  - `data-testid="message-input"` — chat input field
  - `data-testid="send-button"` — send button
  - `data-testid="room-list"` — room list container
  - `data-testid="room-{id}"` — individual room button
  - `data-testid="room-name"` — room name text
  - `data-testid="message-list"` — message list container
  - `data-testid="message-{id}"` — individual message
  - `data-testid="message-bubble"` — message bubble container
  - `data-testid="agent-avatar"` — agent avatar
  - `data-testid="agent-name"` — agent name text

### Removed

- Global `io` export from `websocket/index.ts`
- Deprecated Room session fields
- JSON `participants` field from Discussion model
