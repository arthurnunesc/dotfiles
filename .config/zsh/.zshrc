### Lines configured by zsh-newuser-install
HISTSIZE=1000
SAVEHIST=1000
setopt beep
# bindkey -v
### End of lines configured by zsh-newuser-install


# Checks which OS we are in and sets the machine variable accordingly
# $OSTYPE is a zsh built-in, so no `uname` fork.
case "$OSTYPE" in
  linux*) machine=linux ;;
  darwin*) machine=mac ;;
  *) machine="OTHER:${OSTYPE}" ;;
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

# Load private agent keys in new interactive shells when configured.
if [ -r "$HOME/.config/agent-secrets/load.sh" ]; then
  . "$HOME/.config/agent-secrets/load.sh"
fi

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

# Resend config
export RESEND_TELEMETRY_DISABLED=1


# Aliases and PATH additions
if [ -d "$HOME/.local/bin" ]; then
    PATH="$HOME/.local/bin:$PATH"
fi
if [ $machine = "mac" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# AI tools reminder
alias '/exit'='exit'
alias ai='print-ai-cli-tools'
alias git-dotfiles='git --git-dir=$HOME/.dotfiles --work-tree=$HOME -c user.email=arthurnunesc@proton.me'
alias code-dotfiles='GIT_DIR="$HOME/.dotfiles" GIT_WORK_TREE="$HOME" code --new-window --disable-extensions "$HOME/.dotfiles.code-workspace"'
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
# Turbo mode: plugins load right after the first prompt is drawn instead of before it.
zinit wait lucid for \
  atload"!_zsh_autosuggest_start" \
    zsh-users/zsh-autosuggestions \
    zdharma-continuum/fast-syntax-highlighting
### ZINIT END ###


# Editor config
export EDITOR=nvim
export VISUAL=nvim


### STARSHIP CONFIG ###
export STARSHIP_CONFIG="$HOME"/.config/starship/starship.toml
# Cached `starship init zsh`: the output is static, and spawning starship costs up to ~0.7s here.
# The cache is rebuilt whenever the starship binary is newer than it (i.e. after an upgrade).
_starship_init="$ZDOTDIR/starship-init.zsh"
if [[ ! -s "$_starship_init" || "${commands[starship]:A}" -nt "$_starship_init" ]]; then
  starship init zsh --print-full-init > "$_starship_init"
fi
source "$_starship_init"
unset _starship_init
