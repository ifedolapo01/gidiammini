# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## Code Quality Standards

These rules are mandatory for all future development in this project.

### File size

- Every source file should stay under **200 lines**. Excludes generated files, dependencies, and build output (`node_modules`, `.next`, `dist`, `build`).
- If a file is approaching 200 lines, refactor it before adding more code to it.
- A file may exceed 200 lines only when splitting it would reduce readability or introduce unnecessary complexity — if that happens, explain why in a comment or in the PR/commit description.
- When you touch an existing file that already exceeds 200 lines, refactor it before adding significant new functionality, whenever practical.

### Code organization

- Every component, hook, utility, service, schema, and helper must have a single responsibility.
- Avoid "God components/files" that mix rendering, business logic, API calls, validation, state management, and utilities in one place.
- Large pages are composed of smaller feature components. Separate business logic from presentation whenever possible.
- Keep related logic together — split by responsibility, not arbitrarily by line count.

### Reusability

- Before creating a new component, hook, utility, service, schema, helper, or constant, search the codebase for an existing equivalent.
- Never create duplicate implementations — extend or reuse existing reusable code instead.
- Prefer composition over duplication, and configuration over customization.

### Code quality

- Prefer readability over clever implementations; prefer modularity over large files.
- Leave the codebase cleaner after every change. Keep imports organized. Remove unused imports and dead code.
- Follow the project's architecture, [design system](../.claude/projects/c--Users-ifedo-clothing-demo-store/memory/gidiammini-design-system.md), and folder structure — see the GidiamMini four-layer architecture (Core / Commerce / Storefront / Admin) and semantic-design-token rules.
- All UI code supports responsiveness, accessibility (WCAG AA, keyboard nav, focus states), and light/dark mode.

### Refactoring rules

- If you notice repeated logic across files, extract it into a shared module (utility, hook, or service) instead of leaving it duplicated.
- If multiple components share the same behavior, create a shared abstraction rather than copying code.
- Never sacrifice readability just to reduce line count. Optimize for long-term maintainability, not the smallest possible file count.

## Local Dev Server / Port Hygiene

- The user runs their own dev server on port 3000. Never kill or touch whatever is already bound to port 3000 (or any port you didn't start yourself) — if it's occupied, let the tooling fall back to the next available port (e.g. 3001) instead of freeing 3000.
- When you start a dev server (or anything else that binds a port) for testing/verification, track its actual PID and shut it down when you're done with it that turn. On Windows, `npm run dev &` spawns `next dev`/`node.exe` as a *child* process — killing the npm wrapper's PID does not kill it. Find and kill the real listener instead, e.g.:
  ```
  netstat -ano | grep ":<port>" | grep LISTENING   # get the real PID bound to the port
  taskkill //F //PID <pid>                          # kill that PID, not the npm wrapper
  ```
- Only ever close a port you personally opened this session. If you're unsure whether a listener is yours, don't kill it — ask first.
