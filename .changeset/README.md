# Changesets

Every PR that changes what users of `zoom-chat-adapter` see (features, fixes,
behaviour changes) needs a changeset. Run:

```bash
pnpm changeset
```

Pick the bump (`patch` / `minor` / `major`) and write a one-line summary aimed at
users. Commit the generated `.changeset/*.md` file with your PR. Docs-only,
CI-only, and test-only PRs do not need one.

See CONTRIBUTING.md ("Releasing") for how the release pipeline works.
