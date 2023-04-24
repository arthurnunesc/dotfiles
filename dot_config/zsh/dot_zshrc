# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/Users/anunes-c/.local/miniconda3/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/Users/anunes-c/.local/miniconda3/etc/profile.d/conda.sh" ]; then
        . "/Users/anunes-c/.local/miniconda3/etc/profile.d/conda.sh"
    else
        export PATH="/Users/anunes-c/.local/miniconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

# Checks which OS we are in and sets the machine variable accordingly
uname_out="$(uname -s)"
case "${uname_out}" in
Linux*) machine=linux ;;
Darwin*) machine=mac ;;
*) machine="OTHER:${uname_out}" ;;
esac

### Lines configured by zsh-newuser-install
HISTFILE=~/.histfile
HISTSIZE=1000
SAVEHIST=1000
setopt beep
bindkey -v
### End of lines configured by zsh-newuser-install

# 42 stuff
alias ccw="gcc -Wall -Wextra -Werror"
alias normr="norminette -R CheckForbiddenSourceHeader"
alias conda42="conda activate 42AI-$USER"

# My aliases
if [ $machine = "linux" ]; then
    if [ -d "$HOME/.local/bin" ]; then
      PATH="$HOME/.local/bin:$PATH"
    fi
    if [ -d "$HOME/.cargo/bin" ]; then
      PATH="$HOME/.cargo/bin:$PATH"
    fi
    alias nvim="nvim.appimage"
    alias vim="nvim.appimage"
    alias vi="nvim.appimage"
    alias v="nvim.appimage"
elif [ $machine = "mac" ]; then
    if [ -d "/sgoinfre/Perso/$USER/.local/bin" ]; then
      PATH="/sgoinfre/Perso/$USER/.local/bin:$PATH"
    fi
    alias go='cd /sgoinfre/Perso/$USER'
    alias nvim="nvim"
    alias vim="nvim"
    alias vi="nvim"
    alias v="nvim"
    cd /sgoinfre/Perso/$USER
fi

alias nvim-lazy="NVIM_APPNAME=lazyvim nvim"
alias nvim-kick="NVIM_APPNAME=kickstart nvim"

function nvims() {
  items=("default" "kickstart" "lazyvim")
  config=$(printf "%s\n" "${items[@]}" | fzf --prompt="  select the neovim config you want  " --height=~50% --layout=reverse --border --exit-0)
  if [[ -z $config ]]; then
    echo "Nothing selected"
    return 0
  elif [[ $config == "default" ]]; then
    config=""
  fi
  NVIM_APPNAME=$config nvim $@
}

bindkey -s ^a "nvims\n"

# Prompt
PS1="$USER: %1~ %# "


### ZINIT ###
declare -A ZINIT  # initial Zinit's hash definition, if configuring before loading Zinit, and then:
if [ $machine = "linux" ]; then
  ZINIT[HOME_DIR]="$HOME/.local/share/zinit"
elif [ $machine = "mac" ]; then
  ZINIT[HOME_DIR]="/sgoinfre/Perso/$USER/.local/share/zinit"
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

### Installing plugins
# Plugin history-search-multi-word loaded with investigating
zinit load zdharma-continuum/history-search-multi-word

# Two regular plugins loaded without investigating
zinit light zsh-users/zsh-autosuggestions
zinit light zdharma-continuum/fast-syntax-highlighting

# Better zsh vi mode
zinit ice depth=1
zinit light jeffreytse/zsh-vi-mode


### STARSHIP CONFIG ###
export STARSHIP_CONFIG="$HOME"/.config/starship/starship.toml
eval "$(starship init zsh)"

