ZDOTDIR="$HOME/.config/zsh"
if [[ $OSTYPE == darwin* && -f "$HOME/Library/LaunchAgents/local.engram-tunnel.plist" ]]; then export ENGRAM_URL=http://127.0.0.1:7437; fi  # mac-remote-engram
