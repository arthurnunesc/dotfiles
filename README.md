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
