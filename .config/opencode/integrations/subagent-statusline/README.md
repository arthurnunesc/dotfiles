# Local V2 statusline plugin

OpenCode 2.1.2 cannot currently install this plugin through its package manager because npm fails dependency-tree resolution. This wrapper loads the V2-compatible `opencode-subagent-statusline` package locally instead.

To update it, change the pinned version in `package.json`, then run:

```sh
pnpm install --ignore-scripts
```

Confirm the new package supports OpenCode V2 before updating.
