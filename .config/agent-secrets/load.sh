# Source this file from a shell startup file to load private agent keys.
if [ -r "$HOME/.config/agent-secrets/secrets.env" ]; then
  _agent_secrets_load() {
    set +a
    set +x
    set -a
    . "$HOME/.config/agent-secrets/secrets.env"
    case $1 in
      *a*) set -a ;;
      *) set +a ;;
    esac
    case $1 in
      *x*) set -x ;;
      *) set +x ;;
    esac
  }
  _agent_secrets_load "$-"
  unset -f _agent_secrets_load
fi
