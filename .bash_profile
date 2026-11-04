if [ -r "$HOME/.profile" ]; then
  . "$HOME/.profile"
fi

if [ -r "$HOME/.config/agent-secrets/load.sh" ]; then
  . "$HOME/.config/agent-secrets/load.sh"
fi

export PATH=$PATH:$HOME/.maestro/bin

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/arthur/.lmstudio/bin"
# End of LM Studio CLI section


# added by noqa
export PATH="$HOME/.local/bin:$PATH"
