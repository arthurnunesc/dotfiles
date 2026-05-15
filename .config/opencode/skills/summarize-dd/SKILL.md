# Skill: summarize-dd

# Summarize Darkest Dungeon Team Compositions

Specialized summarizer for Darkest Dungeon guide videos, especially YouTube videos that show team compositions. Use this when the user asks to summarize a Darkest Dungeon video, extract party comps, parse hero teams, or repeat the `Antiquarian and You` style workflow.

This skill is a focused variation of `summarize`. It returns only the Darkest Dungeon team-composition information requested by the user, not a general video summary.

## Activation

Use this skill for requests like:

- `summarize-dd <YouTube URL>`
- `summarize this Darkest Dungeon guide and show team comps`
- `extract the team compositions from this DD video`
- `only show heroes, skills, replacements, and strategy`
- Any Darkest Dungeon video where the user asks for parties, comps, skills, ranks, or strategy.

If the user asks for a normal article/video summary, use `summarize` instead.

## Core Workflow

1. Extract video metadata and chapters first.
2. Extract transcript/subtitles.
3. Use chapters, description timestamps, or visible section labels as authoritative composition titles when available.
4. Search the full transcript for all team sections before answering.
5. Cross-reference extracted heroes and skill names against the local wiki data, then order each hero's skill list according to the wiki page order, not the order mentioned in the video.
6. Verify the number of team comps. Many Darkest Dungeon guide videos in this style show exactly three comps. Do not stop after one or two if the chapters or transcript indicate more.
7. Return only team-composition content unless the user explicitly asks for broader summary.

## Extraction Tools

Prefer direct access through available tools first. If local CLI extraction is needed, verify the tool exists before using it.

Useful commands:

```bash
yt-dlp --skip-download --print "%(chapters)#j" "<url>"
yt-dlp --skip-download --print "%(description)s" "<url>"
yt-dlp --skip-download --write-auto-subs --write-subs --sub-lang en --sub-format vtt -o "/tmp/%(id)s.%(ext)s" "<url>"
```

If `yt-dlp` is missing, explain the missing dependency and ask before installing anything.

If `ffmpeg` warnings appear while downloading subtitles, they usually do not block transcript extraction. Mention only if relevant.

## What To Extract

For each team composition, extract:

- Team title from chapter metadata, description timestamp, visible section title, or transcript heading.
- Hero order by rank, from R4 to R1, when inferable.
- Replacements or flexible hero slots.
- Must-have combat skills only.
- Important alternate skills only when the speaker explicitly presents them as swaps or region-dependent options.
- Skills ordered by the local wiki page order for that hero, not by transcript mention order.
- Compact strategy: opening turns, core combo, target priority, sustain/control plan, and what each hero contributes.

Do not include:

- Full trinket lists unless the user asks.
- General character overview.
- Long explanations of every skill.
- Unrelated video commentary.
- Non-team guide sections.

## Output Format

Default to this compact format:

```markdown
**Team: <Title>**
Heroes:
- R4 <Hero or replacement>: `<Skill>`, `<Skill>`, `<Skill>`, `<Skill>`
- R3 <Hero or replacement>: `<Skill>`, `<Skill>`, `<Skill>`, `<Skill>`
- R2 <Hero or replacement>: `<Skill>`, `<Skill>`, `<Skill>`, `<Skill>`
- R1 <Hero or replacement>: `<Skill>`, `<Skill>`, `<Skill>`, `<Skill>`

Strategy:
- <Core opening or combo.>
- <How the team kills/stalls/sustains.>
- <Important replacement or caveat if needed.>
```

Keep skill names inline with hero names. This is the preferred format learned from the user.

## Wiki Cross-Reference And Skill Ordering

Always cross-reference extracted Darkest Dungeon hero and skill names against the local wiki scraper data before finalizing.

Local wiki data path:

```text
~/Developer/darkest-dungeon-wiki-scraper/darkestdungeon_wiki
```

Equivalent absolute path:

```text
/Users/arthur/Developer/darkest-dungeon-wiki-scraper/darkestdungeon_wiki
```

Use this data to:

- Verify exact hero names.
- Verify exact combat skill names.
- Resolve transcript spelling mistakes.
- Order each hero's listed skills in the same order as they appear on that hero's wiki page.

Canonical ordering rule:

- Find the relevant hero page, usually `<Hero> (Darkest Dungeon).wiki`; some pages use short names or redirects, e.g. `Antiquarian.wiki` redirects to `Antiquarian (Darkest Dungeon)`.
- In the hero page, use the order of `{{heroability` / `{{Heroability` blocks under `==Combat Skills==`.
- Within each block, read the canonical skill name from `|name=` or `| name=`.
- Sort the extracted skill list to match that wiki order.
- Preserve explicit alternatives, but still order each alternative group according to wiki order when possible.
- Do not reorder hero party ranks. Hero lines stay R4 -> R1; only the skill list within each hero line follows wiki order.

Example: if the video mentions Highwayman's `Duelist's Advance` before `Pistol Shot`, but the wiki page orders Highwayman skills as `Wicked Slice`, `Pistol Shot`, `Point Blank Shot`, `Grapeshot Blast`, `Tracking Shot`, `Duelist's Advance`, `Open Vein`, then the output skill list should place `Pistol Shot` and `Point Blank Shot` before `Duelist's Advance`.

Fallback rules:

- If the wiki page is missing, unreadable, or ambiguous, use transcript order and mark uncertainty briefly.
- If a skill appears in the transcript but not on the wiki page, keep it only if context clearly identifies it; otherwise mark it as uncertain.
- If using Musketeer/Arbalest paired equivalents, use each hero's own wiki naming: `Aimed Shot`, `Smokescreen`, `Patch Up`, `Skeet Shot` for Musketeer; `Sniper Shot`, `Suppressing Fire`, `Battlefield Bandage`, `Rallying Flare` for Arbalest.
- Prefer wiki naming over transcript naming. For example, output `Smokescreen`, not `Smoke Screen`, if the Musketeer wiki page uses `Smokescreen`.

## Darkest Dungeon Normalization

Auto-captions often mishear Darkest Dungeon terms. Normalize obvious errors without overcorrecting uncertain text.

Common corrections:

- `aquarian`, `aquarium` -> `Antiquarian`
- `anti` in this context -> `Antiquarian`
- `repost`, `her post` -> `Riposte`
- `man arms`, `man in arms`, `man at arms` -> `Man-at-Arms`
- `flatulent`, `flagellate` -> `Flagellant`
- `arvolest`, `our blessed` -> `Arbalest`
- `vessel` -> `Vestal`
- `helium`, `helene` -> `Hellion`
- `reynosaros`, `reina sorrows`, `rain of sorrows` -> `Rain of Sorrows`
- `dual advance`, `duels advance`, `duelist advance` -> `Duelist's Advance`
- `hands from the abyss` -> `Hands from the Abyss`
- `sack stab` -> `Sacrificial Stab`
- `yap` -> `Yawp`
- `title slam` -> `Tidal Slam`
- `play grenade` -> `Plague Grenade`
- `screen` for Musketeer/Arbalest utility -> `Smokescreen` for Musketeer, `Suppressing Fire` when the context is Arbalest/Musketeer accuracy debuffing multiple enemies

If a correction is uncertain, phrase it conservatively, e.g. `likely <Skill>`.

## Completeness Checks

Before finalizing:

- Compare transcript sections against video chapters.
- If chapter metadata lists three team chapters, output all three.
- Ensure every team has a title.
- Ensure every hero line includes skills inline.
- Ensure each hero's skills are sorted by local wiki order, not transcript order.
- Ensure replacements are included where the speaker explicitly allows them.
- Ensure the final answer is only about the team compositions.

## Known Example: Antiquarian and You

For `https://www.youtube.com/watch?v=8WAMK9p90Mc`, the chapter metadata has three teams:

- `Team: Riposte Escort`
- `Team: The Scoundrels™`
- `Team: Anti Backline`

Do not miss `Team: Anti Backline`; it starts around `50:46` and runs until the outro.

Known corrected summary shape:

```markdown
**Team: Riposte Escort**
Heroes:
- R4 Antiquarian: `Nervous Stab` or `Festering Vapours`, `Flashpowder`, `Fortifying Vapours`, `Protect Me`
- R3 Highwayman: `Wicked Slice` or `Open Vein`, `Pistol Shot`, `Point Blank Shot`, `Duelist's Advance`
- R2 Vestal: `Judgement`, `Dazzling Light`, `Divine Grace`, `Divine Comfort`
- R1 Hellion, or another frontline damage dealer: `Wicked Hack`, `Iron Swan`, `Barbaric YAWP!`, `If It Bleeds`, `Bleed Out`

Strategy:
- Use `Protect Me` on Highwayman, then `Duelist's Advance` to set up Riposte.
- Highwayman soaks targeted attacks and returns damage.
- Vestal opens with stun from rank 2, then gets pushed back.
- Hellion/frontliner helps delete rank 4 and clean up priority targets.

**Team: The Scoundrels™**
Heroes:
- R4 Antiquarian: `Festering Vapours`, `Flashpowder`, `Fortifying Vapours`, `Protect Me`
- R3 Houndmaster: `Hound's Rush`; flexible slots include `Hound's Harry`, mark, `Cry Havoc`, guard, or `Blackjack`
- R2 Man-at-Arms: `Bellow`, `Defender`, `Retribution`
- R1 Occultist: `Sacrificial Stab`, `Wyrd Reconstruction`, `Vulnerability Hex`, `Hands from the Abyss`

Strategy:
- Antiquarian uses `Protect Me` on Man-at-Arms.
- Man-at-Arms uses `Retribution` for Riposte and `Bellow` for speed/accuracy control.
- Occultist marks priority targets or stuns.
- Houndmaster is the main damage dealer, with optional stress-heal/utility.

**Team: Anti Backline**
Heroes:
- R4 Musketeer or Arbalest: `Aimed Shot`/`Sniper Shot`, `Smokescreen`/`Suppressing Fire`, `Patch Up`/`Battlefield Bandage`, `Skeet Shot`/`Rallying Flare`
- R3 Plague Doctor: `Noxious Blast`, `Plague Grenade`, `Blinding Gas`, `Battlefield Medicine`
- R2 Flagellant: `Punish`, `Rain of Sorrows`, `Exsanguinate`, `Reclaim`
- R1 Antiquarian: `Nervous Stab`, `Festering Vapours`, `Flashpowder`, `Protect Me`

Strategy:
- Antiquarian repeatedly uses `Protect Me` on Flagellant.
- Plague Doctor opens with `Blinding Gas`; Flagellant uses `Rain of Sorrows`.
- `Plague Grenade` plus `Rain of Sorrows` rapidly deletes both backliners.
- `Flashpowder`, `Noxious Blast`, and `Smokescreen`/`Suppressing Fire` stack accuracy debuffs.
```

Use this example as a formatting and correction reference, not as a template to force onto unrelated videos.

## Style Rules

- Respond in the user's language.
- Keep output compact and useful for gameplay.
- Prefer exact game terms and skill names.
- If transcript evidence is incomplete, say what is uncertain instead of inventing.
- Do not create files unless the user explicitly asks for saved output. The skill itself is the exception when the user is asking to create this skill.
