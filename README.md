# dotfiles

Managed as a bare git repo with `$HOME` as the work tree. No symlinks, no install scripts — files live in their real locations.

## Usage

Every git command uses these flags instead of an alias:

```bash
git --git-dir=$HOME/.dotfiles --work-tree=$HOME
```

### Common commands

```bash
# Check status
git --git-dir=$HOME/.dotfiles --work-tree=$HOME status

# Add a file
git --git-dir=$HOME/.dotfiles --work-tree=$HOME add ~/.config/some/file

# Commit
git --git-dir=$HOME/.dotfiles --work-tree=$HOME commit -m "Add some config"

# Push
git --git-dir=$HOME/.dotfiles --work-tree=$HOME push

# View tracked files
git --git-dir=$HOME/.dotfiles --work-tree=$HOME ls-files
```

## Setup on a new machine

```bash
git clone --bare git@github.com:arthurnunesc/dotfiles.git $HOME/.dotfiles
git --git-dir=$HOME/.dotfiles --work-tree=$HOME checkout
git --git-dir=$HOME/.dotfiles --work-tree=$HOME config --local status.showUntrackedFiles no
```

If checkout conflicts with existing files, back them up first:

```bash
git --git-dir=$HOME/.dotfiles --work-tree=$HOME checkout 2>&1 | grep "^\t" | xargs -I{} mv {} {}.bak
git --git-dir=$HOME/.dotfiles --work-tree=$HOME checkout
```
