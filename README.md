# dotfiles

Bare git repo with `$HOME` as the work tree, so files just live in their real locations.

## Setup on a new machine

```bash
git clone --bare git@github.com:arthurnunesc/dotfiles.git $HOME/.dotfiles
alias git-dotfiles='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'  # also in .zshenv
git-dotfiles checkout
```

If checkout conflicts with existing files, back them up first:

```bash
git-dotfiles checkout 2>&1 | grep "^\t" | xargs -I{} mv {} {}.bak
git-dotfiles checkout
```

### Global gitignore

This repo tracks a `~/.gitignore` that ignores everything except whitelisted dotfiles. If you already have a global gitignore at `~/.gitignore`, move it to the XDG default location (`~/.config/git/ignore`) before checkout to avoid it being overwritten.
