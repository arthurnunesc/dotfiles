### Lines configured by zsh-newuser-install
HISTFILE=~/.histfile
HISTSIZE=1000
SAVEHIST=1000
setopt beep
bindkey -v
### End of lines configured by zsh-newuser-install

# Checks which OS we are in and sets the machine variable accordingly
uname_out="$(uname -s)"
case "${uname_out}" in
  Linux*) machine=linux ;;
  Darwin*) machine=mac ;;
  *) machine="OTHER:${uname_out}" ;;
esac

# Aliases and PATH additions
if [ $machine = "linux" ]; then
    if [ -d "$HOME/.local/bin" ]; then
      PATH="$HOME/.local/bin:$PATH"
    fi
    if [ -d "$HOME/.cargo/bin" ]; then
      PATH="$HOME/.cargo/bin:$PATH"
    fi
elif [ $machine = "mac" ]; then
    export USER_SHARE="/sgoinfre/Perso/$USER"
    export EDITOR="$USER_SHARE/.local/bin/nvim"
    if [ -d "$USER_SHARE/.local/bin" ]; then
      PATH="$USER_SHARE/.local/bin:$PATH"
    fi
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi


### ZINIT ###
declare -A ZINIT  # initial Zinit's hash definition, if configuring before loading Zinit, and then:
if [ $machine = "linux" ]; then
  ZINIT[HOME_DIR]="$HOME/.local/share/zinit"
elif [ $machine = "mac" ]; then
  ZINIT[HOME_DIR]="$USER_SHARE/.local/share/zinit"
fi

### Added by Zinit's installer
if [ ! -f ${ZINIT[HOME_DIR]}/zinit.git/zinit.zsh ]; then
    print -P "%F{33} %F{220}Installing %F{33}ZDHARMA-CONTINUUM%F{220} Initiative Plugin Manager (%F{33}zdharma-continuum/zinit%F{220})…%f"
    command mkdir -p "${ZINIT[HOME_DIR]}" && command chmod g-rwX "${ZINIT[HOME_DIR]}"
    command git clone https://github.com/zdharma-continuum/zinit "${ZINIT[HOME_DIR]}/zinit.git" && \
        print -P "%F{33} %F{34}Installation successful.%f%b" || \
        print -P "%F{160} The clone has failed.%f%b"
fi

source "${ZINIT[HOME_DIR]}/zinit.git/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit
### End of Zinit's installer chunk


## Installing plugins
# Two regular plugins loaded without investigating
zinit light zsh-users/zsh-autosuggestions
zinit light zdharma-continuum/fast-syntax-highlighting
### ZINIT END ###


### STARSHIP CONFIG ###
export STARSHIP_CONFIG="$HOME"/.config/starship/starship.toml
eval "$(starship init zsh)"

