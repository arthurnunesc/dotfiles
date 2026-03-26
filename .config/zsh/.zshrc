### Lines configured by zsh-newuser-install
HISTSIZE=1000
SAVEHIST=1000
setopt beep
# bindkey -v
### End of lines configured by zsh-newuser-install

# Android Studio emulator config
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home

# pipenv config
export PIPENV_VENV_IN_PROJECT=1
export PIPENV_IGNORE_VIRTUALENVS=1

# Checks which OS we are in and sets the machine variable accordingly
uname_out="$(uname -s)"
case "${uname_out}" in
  Linux*) machine=linux ;;
  Darwin*) machine=mac ;;
  *) machine="OTHER:${uname_out}" ;;
esac


# Aliases and PATH additions
if [ -d "$HOME/.local/bin" ]; then
    PATH="$HOME/.local/bin:$PATH"
fi
if [ $machine = "mac" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi


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
# Two regular plugins loaded without investigating
zinit light zsh-users/zsh-autosuggestions
zinit light zdharma-continuum/fast-syntax-highlighting
### ZINIT END ###


### STARSHIP CONFIG ###
export STARSHIP_CONFIG="$HOME"/.config/starship/starship.toml
eval "$(starship init zsh)"


export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
