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
