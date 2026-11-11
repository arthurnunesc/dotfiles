# dotfiles

Bare git repo with `$HOME` as the work tree, so files just live in their real locations.

## Setup on a new machine

```bash
git clone --bare git@github.com:arthurnunesc/dotfiles.git $HOME/.dotfiles
alias git-dotfiles='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
git-dotfiles checkout
```

If checkout fails because some files already exist, it will list the conflicting files. You can see them with:

```bash
git-dotfiles checkout 2>&1 | grep "^\t"
```

Then either **overwrite** them:

```bash
git-dotfiles checkout -f
```

Or **back them up first**, then retry:

```bash
mkdir -p $HOME/.dotfiles-backup
git-dotfiles checkout 2>&1 | grep "^\t" | xargs -I{} sh -c \
  'mkdir -p "$HOME/.dotfiles-backup/$(dirname "{}")" && mv "$HOME/{}" "$HOME/.dotfiles-backup/{}"'
git-dotfiles checkout
```

After checkout, the `git-dotfiles` alias is defined in `.zshenv` and will be available in new shells.

## Global agent API keys

Store global API keys in `~/.config/agent-secrets/secrets.env`, with directory permissions `700` and file permissions `600`. The private file is never versioned; only the loader and an empty example are tracked. Use the plain `KEY=value` EnvFile format or quoted literal values. Do not use commands, `export`, interpolation, or multiline values.

The shell hook loads keys only in new terminals. After pulling these dotfiles, transfer the private file manually over SSH; actual values are not included in the repository. User systemd drop-ins need activation. On Linux, copy the private file first, confirm no work is running, then restart only the `opencode-autostart` and `t3code` user units. On macOS, stop OpenCode and start it from a new terminal after the shell hook loads the key. Do not use a GUI/launchd environment importer: a GUI started before the terminal cannot receive the key.

For rotation, update the private file and manually copy the new file to each machine, then restart the affected app or units. Native OAuth, SSH credentials, and project or production secrets are not copied by this setup.

## Engram and T3 scratch threads

T3 scratch threads ("No project") save Engram memories to the project `general`. `.local/bin/engram-t3` writes `{"project_name":"general"}` to `.engram/config.json` in a scratch thread folder (`$T3CODE_HOME/scratch/<thread>`, outside Git, without a config), then runs `engram`. Codex and Pi use it as their Engram MCP command. OpenCode loads `.config/opencode/plugins/engram-t3.ts`, which runs the same step and then the upstream plugin.

`.config/opencode/engram/engram.ts` is the unchanged upstream plugin. To update it, copy upstream `plugin/opencode/engram.ts` from the release tag to that path. Do not run `engram setup opencode`: it installs a second copy in `plugins/` and adds a second MCP entry.
