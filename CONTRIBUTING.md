# Contributing to zoom-chat-adapter

Thanks for helping improve this community-maintained Zoom adapter for Chat SDK! This guide covers local setup, verification, and how to submit changes.

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) 9+

## Setup

```bash
pnpm install
```

This installs `chat` and `@chat-adapter/shared` from npm plus all dev dependencies.

## Development

```bash
pnpm dev        # watch mode rebuild
pnpm build      # production build (dist/index.js + dist/index.d.ts)
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest with coverage (53 tests)
pnpm test:watch # watch mode
pnpm check      # ultracite/biome lint check (must report 0 errors)
pnpm fix        # ultracite/biome auto-fix lint and formatting
pnpm clean      # remove dist/
```

## Linting and pre-commit hooks

This project uses [Ultracite](https://www.ultracite.ai/) (Biome preset, see `biome.jsonc`) for linting and formatting, wired up with [Husky](https://typicode.github.io/husky/). The setup is automatic — `pnpm install` runs the `prepare` script, which installs the Git hooks.

On every commit, the pre-commit hook:

1. Runs `ultracite fix` on staged files and re-stages the fixes
2. Runs `ultracite check` on staged files — **the commit is blocked if any lint errors remain**

You can run the same checks manually with `pnpm check` / `pnpm fix`. Please don't disable rules or add ignore comments to make the check pass — the only accepted suppressions are narrowly scoped ones where a rule conflicts with the `chat` SDK's `Adapter` interface contract, each with a justification comment.

## Before submitting

Every change must keep the full suite green:

1. `pnpm check` — must report 0 errors
2. `pnpm build` — must exit 0
3. `pnpm typecheck` — must exit 0
4. `pnpm test` — all 53 tests must pass (36 in `src/index.test.ts`, 17 in `src/markdown.test.ts`)

If a test fails, triage and report it — do not patch adapter source just to force it green without understanding the cause.

### Verifying against the `chat` SDK API

The adapter imports its SDK surface from the `chat` package. Don't guess at API usage — check the installed type definitions:

```bash
# e.g. verify Adapter interface, Chat options, logger API
grep -n "interface Adapter" node_modules/chat/dist/index.d.ts
```

## Pull requests

1. Fork the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/short-description
   ```
2. Make focused changes — one concern per PR.
3. Add or update tests in `src/*.test.ts` for behavior changes.
4. Run the full verification above and include the results in your PR description.
5. Open a PR against `main` with a clear title and description:
   - What changed and why
   - Test/build/typecheck results
   - Any Zoom platform behavior worth noting

### Changesets

If your PR changes anything users of the package will notice (feature, fix, behaviour
change), add a changeset:

```bash
pnpm changeset
```

Choose `patch`, `minor` or `major`, write a one-line user-facing summary, and commit the
generated `.changeset/*.md` file. Docs-, test- and CI-only PRs don't need one.

## Releasing

Releases are automated by [Changesets](https://github.com/changesets/changesets) and
`.github/workflows/release.yml`. Maintainers never bump versions or run `npm publish` by hand.

1. PRs with changesets merge into `main`.
2. The workflow opens (or updates) a **"chore: version packages"** PR that bumps
   `package.json` and writes `CHANGELOG.md`.
3. Merging that PR makes the workflow build, publish to npm, tag the release and create a
   GitHub Release.

Publishing uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC):
there is no `NPM_TOKEN` secret. The trusted publisher on npmjs.com must be configured for
repository `aradhyacp/zoom-chat-adapter`, workflow filename `release.yml`. Published versions
carry a provenance attestation.

### Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>
```

Examples: `feat: support message reactions`, `fix: refresh OAuth token before expiry`, `docs: clarify webhook setup`, `chore: bump dev dependencies`.

## Reporting issues

Include:

- Package version (`zoom-chat-adapter`), `chat` SDK version, Node version
- Minimal reproduction (config + webhook payload with secrets redacted)
- Relevant logs — on webhook verification failures, the adapter logs raw body hex to aid diagnosis
- For suspected Zoom platform bugs, reference any Zoom support ticket IDs (e.g. ZOOM-506645 for the Unicode HMAC issue)

## Code of conduct

Be kind and constructive. This is a community project — review others' work the way you'd want yours reviewed.
