### Lines configured by zsh-newuser-install
HISTSIZE=1000
SAVEHIST=1000
setopt beep
# bindkey -v
### End of lines configured by zsh-newuser-install


# Checks which OS we are in and sets the machine variable accordingly
uname_out="$(uname -s)"
case "${uname_out}" in
  Linux*) machine=linux ;;
  Darwin*) machine=mac ;;
  *) machine="OTHER:${uname_out}" ;;
esac

# Android Studio config
if [ $machine = "mac" ]; then
  export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/emulator
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  export PATH=$PATH:$HOME/.maestro/bin
fi

# Node/nvm config
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Bun config
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# pipenv config
export PIPENV_VENV_IN_PROJECT=1
export PIPENV_IGNORE_VIRTUALENVS=1


# Aliases and PATH additions
if [ -d "$HOME/.local/bin" ]; then
    PATH="$HOME/.local/bin:$PATH"
fi
if [ -d "$HOME/.antigravity/antigravity/bin" ]; then
    PATH="$HOME/.antigravity/antigravity/bin:$PATH"
fi
if [ $machine = "mac" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/arthur/.lmstudio/bin"
# End of LM Studio CLI section

# AI tools reminder
alias ai='print-ai-cli-tools'
alias git-dotfiles='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
alias agy-dotfiles='GIT_DIR="$HOME/.dotfiles" GIT_WORK_TREE="$HOME" agy "$HOME"'

### ZINIT ###
## Zinit installer chunk ##
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"
[ ! -d $ZINIT_HOME ] && mkdir -p "$(dirname $ZINIT_HOME)"
[ ! -d $ZINIT_HOME/.git ] && git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
source "${ZINIT_HOME}/zinit.zsh"

autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit
## End of Zinit installer chunk ##

## Installing plugins
zinit light zsh-users/zsh-autosuggestions
zinit light zdharma-continuum/fast-syntax-highlighting
zinit ice depth=1
zinit light jeffreytse/zsh-vi-mode
### ZINIT END ###


# Editor config
export EDITOR=nvim
export VISUAL=nvim


### STARSHIP CONFIG ###
export STARSHIP_CONFIG="$HOME"/.config/starship/starship.toml
eval "$(starship init zsh)"
