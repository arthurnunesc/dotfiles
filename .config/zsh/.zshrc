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

  # Load the Bitwarden Secrets Manager token from macOS Keychain for Varlock.
  export BITWARDEN_ACCESS_TOKEN="$(security find-generic-password -s bitwarden-varlock-token -w 2>/dev/null)"
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

# AWS config
export AWS_PROFILE=dev


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
alias '/exit'='exit'
alias ai='print-ai-cli-tools'
alias git-dotfiles='git --git-dir=$HOME/.dotfiles --work-tree=$HOME'
alias code-dotfiles='GIT_DIR="$HOME/.dotfiles" GIT_WORK_TREE="$HOME" code "$HOME"'
alias pi='env -u AWS_PROFILE pi'

opencode() {
  local real_opencode="/opt/homebrew/bin/opencode"
  local db="$HOME/.local/share/opencode/opencode.db"

  if [[ "${OPENCODE_AUTO_RESUME:-1}" == "0" ]]; then
    command "$real_opencode" "$@"
    return $?
  fi

  if (( $# > 1 )); then
    command "$real_opencode" "$@"
    return $?
  fi

  local project_dir
  if (( $# == 1 )); then
    if [[ "$1" == -* || ! -d "$1" ]]; then
      command "$real_opencode" "$@"
      return $?
    fi
    project_dir="$(cd "$1" 2>/dev/null && pwd -P)" || {
      command "$real_opencode" "$@"
      return $?
    }
  else
    project_dir="$(pwd -P)"
  fi

  local project_root
  project_root="$(git -C "$project_dir" rev-parse --show-toplevel 2>/dev/null)" || project_root="$project_dir"
  project_root="$(cd "$project_root" 2>/dev/null && pwd -P)" || project_root="$project_dir"

  local lock_dir="$HOME/.local/state/opencode/auto-resume"
  local project_key
  mkdir -p "$lock_dir"
  project_key="$(printf '%s' "$project_root" | cksum | awk '{print $1}')"
  local lock_file="$lock_dir/$project_key.pid"

  if [[ -r "$lock_file" ]]; then
    local running_pid running_root
    IFS=$'\t' read -r running_pid running_root < "$lock_file"
    if [[ "$running_root" == "$project_root" && -n "$running_pid" ]] && kill -0 "$running_pid" 2>/dev/null; then
      printf 'OpenCode is already running for %s; starting a new session instead of resuming the same one.\n' "$project_root" >&2
      command "$real_opencode" "$@"
      return $?
    fi
    rm -f "$lock_file"
  fi

  local session_id=""
  if [[ -r "$db" ]] && command -v sqlite3 >/dev/null 2>&1; then
    local escaped_root escaped_dir sql
    escaped_root="${project_root//\'/\'\'}"
    escaped_dir="${project_dir//\'/\'\'}"
    if [[ "$project_root" == "/" ]]; then
      sql="select id from session where time_archived is null and directory = '$escaped_dir' order by time_updated desc limit 1;"
    else
      sql="select id from session where time_archived is null and (directory = '$escaped_root' or directory like '$escaped_root/%') order by time_updated desc limit 1;"
    fi
    session_id="$(sqlite3 -cmd '.timeout 1000' "$db" "$sql" 2>/dev/null | head -n 1)"
  fi

  printf '%s\t%s\n' "$$" "$project_root" > "$lock_file"
  trap 'rm -f "$lock_file"' EXIT INT TERM
  if [[ -n "$session_id" ]]; then
    command "$real_opencode" -s "$session_id"
  else
    command "$real_opencode" "$project_dir"
  fi
  local status=$?
  rm -f "$lock_file"
  trap - EXIT INT TERM
  return $status
}
alias opencode='env -u AWS_PROFILE opencode'

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
### ZINIT END ###


# Editor config
export EDITOR=nvim
export VISUAL=nvim


### STARSHIP CONFIG ###
export STARSHIP_CONFIG="$HOME"/.config/starship/starship.toml
eval "$(starship init zsh)"
