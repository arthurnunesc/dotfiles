# dotfiles

Managed as a bare git repo with `$HOME` as the work tree. No symlinks, no install scripts — files live in their real locations.

## Usage

An alias is defined in `.zshenv`:

```bash
alias git-dotfiles='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
```

### Common commands

```bash
git-dotfiles status
git-dotfiles add ~/.config/some/file
git-dotfiles commit -m "Add some config"
git-dotfiles push
git-dotfiles ls-files
```

## Setup on a new machine

```bash
git clone --bare git@github.com:arthurnunesc/dotfiles.git $HOME/.dotfiles
git-dotfiles checkout
git-dotfiles config --local status.showUntrackedFiles no
```

If checkout conflicts with existing files, back them up first:

```bash
git-dotfiles checkout 2>&1 | grep "^\t" | xargs -I{} mv {} {}.bak
git-dotfiles checkout
```
