#!/bin/sh
# Claude Code status line script

input=$(cat)

# --- colors ---
BOLD='\033[1m'
ORANGE='\033[38;5;166m'
BLUE='\033[38;5;33m'
GREEN='\033[38;5;28m'
RESET='\033[0m'

# Box: content area = 72 chars, total line width = 74 (content + " |")
CONTENT_W=72
LINE1_FIXED=38  # "context [" (9) + bar (20) + "] " (2) + pct (3) + "% | " (4)

# --- helpers ---
make_bar() {
  pct="$1"
  color="$2"
  width=20
  filled=$(awk "BEGIN { printf \"%d\", ($pct / 100) * $width }")
  empty=$((width - filled))
  bar=""
  i=0
  while [ $i -lt $filled ]; do bar="${bar}█"; i=$((i+1)); done
  i=0
  while [ $i -lt $empty ];  do bar="${bar}░"; i=$((i+1)); done
  printf "${BOLD}${color}%s${RESET}" "$bar"
}

make_padding() {
  n="$1"
  pad=""
  i=0
  while [ $i -lt $n ]; do pad="${pad} "; i=$((i+1)); done
  printf "%s" "$pad"
}

# --- line 1: context bar | model | ---
model=$(echo "$input" | jq -r '.model.display_name // "Unknown"' | tr '[:upper:]' '[:lower:]')
ctx_used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

MODEL_QUADRANT=$((CONTENT_W - LINE1_FIXED))  # 34 chars
model_len=$(printf "%s" "$model" | wc -c | tr -d ' ')
total_pad=$((MODEL_QUADRANT - model_len))
[ $total_pad -lt 0 ] && total_pad=0
left_pad=$((total_pad / 2))
right_pad=$((total_pad - left_pad))
padding_left=$(make_padding $left_pad)
padding_right=$(make_padding $right_pad)

if [ -n "$ctx_used" ]; then
  ctx_pct=$(awk "BEGIN { printf \"%.0f\", $ctx_used }")
  ctx_bar=$(make_bar "$ctx_used" "$ORANGE")
  printf "${BOLD}context [%b${BOLD}] %3s%% | %s%s%s |${RESET}" "$ctx_bar" "$ctx_pct" "$padding_left" "$model" "$padding_right"
else
  printf "${BOLD}context [${ORANGE}%s${RESET}${BOLD}]  --%%  | %s%s%s |${RESET}" "--------------------" "$padding_left" "$model" "$padding_right"
fi

printf "\n"

# --- separator: 36 dashes + | + 36 dashes + | = 74 chars wide ---
# The middle | aligns with the | separators in line 1 and line 2
sep1=""
i=0; while [ $i -lt 36 ]; do sep1="${sep1}─"; i=$((i+1)); done
sep2=""
i=0; while [ $i -lt 36 ]; do sep2="${sep2}─"; i=$((i+1)); done
printf "${BOLD}%s|%s|${RESET}\n" "$sep1" "$sep2"

# --- line 2: session bar | weekly bar | ---
# Fixed visual width = 72 = CONTENT_W, so no padding needed
five_pct=$(echo "$input"  | jq -r '.rate_limits.five_hour.used_percentage  // empty')
seven_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage  // empty')

line2=""

if [ -n "$five_pct" ]; then
  f=$(awk "BEGIN { printf \"%.0f\", $five_pct }")
  bar=$(make_bar "$five_pct" "$BLUE")
  line2="session [${bar}${BOLD}] $(printf '%3s' $f)%"
fi

if [ -n "$seven_pct" ]; then
  s=$(awk "BEGIN { printf \"%.0f\", $seven_pct }")
  bar=$(make_bar "$seven_pct" "$GREEN")
  entry="weekly [${bar}${BOLD}] $(printf '%3s' $s)%"
  if [ -n "$line2" ]; then
    line2="${line2} | ${entry}"
  else
    line2="$entry"
  fi
fi

if [ -n "$line2" ]; then
  # Pad to CONTENT_W in case only one bar is shown
  line2_vis=$(printf "%b" "$line2" | sed 's/\x1b\[[0-9;]*m//g' | wc -c | tr -d ' ')
  pad2=$((CONTENT_W - line2_vis))
  [ $pad2 -lt 0 ] && pad2=0
  padding2=$(make_padding $pad2)
  printf "${BOLD}%b${BOLD}%s |${RESET}\n" "$line2" "$padding2"
fi
