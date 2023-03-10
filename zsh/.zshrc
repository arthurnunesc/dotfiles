# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Lines configured by zsh-newuser-install
HISTFILE=~/.histfile
HISTSIZE=1000
SAVEHIST=1000
setopt beep
bindkey -e

# End of lines configured by zsh-newuser-install
# The following lines were added by compinstall
zstyle :compinstall filename '/home/arthurnunesc/.zshrc'

autoload -Uz compinit
compinit
# End of lines added by compinstall

# 42 stuff
alias ccw="gcc -Wall -Wextra -Werror"
alias normr="norminette -R CheckForbiddenSourceHeader"

# Prompt
PS1="arthur: %1~ %# "

# Theme
source "$HOME"/.powerlevel10k/powerlevel10k.zsh-theme

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Plugins
source "$HOME"/.config/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
