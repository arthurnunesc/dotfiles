---
name: summarize-call
description: Transcribe and summarize call recordings directly in the conversation. Use when the user provides an audio or video call recording and wants speaker-aware notes, decisions, action items, or a transcript without creating Obsidian notes.
user_invocable: true
---

# Summarize Call

Output-only call summarizer. This skill is derived from `reysu/ai-life-skills` under the MIT License, simplified to return call summaries in chat instead of creating Obsidian vault notes.

## Core Behavior

Transcribe and summarize a call recording directly in the conversation. Do not create meeting notes, transcript files, person notes, daily notes, reference notes, vault folders, or Obsidian metadata unless the user explicitly asks for files.

Use this skill for:

- MP4, MOV, WAV, MP3, M4A, or other audio/video call recordings
- User requests such as `/summarize-call ~/Downloads/call.mp4`, `summarize this meeting`, or `extract action items from this recording`

## Inputs

- `recording`: file path to the call recording
- `participants`: optional names of people on the call
- `date/time`: optional, infer from filename or metadata when reliable
- `speaker_count`: optional, ask only if diarization requires it and the count is ambiguous
- `depth`: optional, detected from invocation

Depth tokens:

- Minimal: `minimal`, `fast`, `quick`, `--minimal`, `-m`
- Detailed: `detailed`, `deep`, `full`, `--detailed`, `-d`

If depth is unspecified, default to practical meeting notes: overview, key topics, decisions, action items, and notable quotes.

## Transcription Method

Choose the simplest available path. Verify tools and credentials before using them.

### Local Path

Requirements:

- `ffmpeg` for audio extraction
- `mlx_whisper` or another available Whisper CLI for transcription
- `pyannote.audio` plus `HF_TOKEN` for speaker diarization when speaker labels are required

Useful commands:

```bash
ffmpeg -v quiet -i "<input>" -vn -acodec pcm_s16le -ar 16000 -ac 1 /tmp/<name>.wav -y
mlx_whisper --model mlx-community/whisper-large-v3-turbo --language en --output-dir /tmp --output-format json --condition-on-previous-text False /tmp/<name>.wav
```

Use `--condition-on-previous-text False` for Whisper to reduce hallucination loops.

### ElevenLabs Scribe Path

Use only if `ELEVENLABS_API_KEY` is available and the user agrees to the paid cloud call. Before using it, state the recording duration and ask for confirmation.

Use diarization when available. Format speaker turns as:

```markdown
[H:MM:SS] **Speaker 1**: text
```

## Interaction Rules

- Never install dependencies without asking.
- Never send audio to a paid or cloud transcription service without explicit confirmation.
- If participant names are unknown, use `Speaker 1`, `Speaker 2`, etc., and ask the user if they want the labels renamed after the summary.
- If diarization is unavailable, still produce a useful summary from the transcript and clearly state that speaker attribution may be missing.
- If transcription is impossible, explain exactly which dependency, credential, or file access is missing.

## Output Format

Default to this shape:

```markdown
**Call Overview**
2-4 sentences covering who spoke, why, and the main outcome.

**Participants**
- Speaker/Name: role or context if known

**Key Topics**
- ...
- ...

**Decisions**
- ...

**Action Items**
- [ ] Owner - task, deadline if known

**Risks / Blockers**
- ...

**Notable Quotes**
> "..." - Speaker, timestamp

**Follow-Ups**
- ...
```

Omit sections that do not apply. For minimal mode, keep it compact. For detailed mode, include richer topic breakdowns, more quotes, unresolved questions, and any commitments made by each participant.

## Optional Transcript

Do not output the full transcript by default. Include it only if the user asks for transcript output, exact quotes, or auditability.

When included, put it after the summary:

```markdown
**Transcript**

[0:00:03] **Speaker 1**: ...
[0:00:14] **Speaker 2**: ...
```

## Style Rules

- Respond in the language of the user's request, not automatically in the recording language. If the call is in another language, summarize it in the request language unless the user explicitly asks to preserve or translate into a different language.
- Do not use Obsidian wikilinks unless the user asks for Obsidian-compatible Markdown.
- Do not invent decisions, owners, deadlines, or quotes.
- Mark uncertain speaker attribution explicitly.
- Separate explicit decisions from inferred next steps.
- Prioritize actionability over exhaustive prose.

## File Output

Default behavior is chat output only. If the user explicitly asks to save a transcript or meeting note, write the requested file only. Do not create vault structures or companion notes.
