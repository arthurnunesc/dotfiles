if [ -r "$HOME/.profile" ]; then
  . "$HOME/.profile"
fi

if [ -r "$HOME/.config/agent-secrets/load.sh" ]; then
  . "$HOME/.config/agent-secrets/load.sh"
fi

export PATH=$PATH:$HOME/.maestro/bin


# added by noqa
export PATH="$HOME/.local/bin:$PATH"
