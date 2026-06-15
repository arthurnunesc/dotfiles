---
name: summarize
description: Summarize YouTube videos, articles, PDFs, EPUBs, podcasts, lectures, files, or pasted text directly in the conversation. Use when the user provides content and wants a useful summary without creating Obsidian notes or writing files.
user_invocable: true
---

# Summarize

Output-only content summarizer. This skill is derived from `reysu/ai-life-skills` under the MIT License, simplified to return summaries in chat instead of creating Obsidian vault notes.

## Core Behavior

Summarize the provided source directly in the conversation. Do not create vault folders, notes, person pages, reference pages, daily notes, transcripts, or Bases entries unless the user explicitly asks for files.

Use this skill for:

- YouTube videos, podcasts, lectures, or other recorded content
- Web articles, blog posts, papers, whitepapers, PDFs, EPUBs, DOCX, TXT, or pasted text
- User requests such as `summarize this`, `/summarize <url>`, `/summarize <file> minimal`, or `/summarize <source> detailed`

## Inputs

- `source`: URL, file path, or pasted text
- `audience`: optional, defaults to general reader
- `depth`: optional, detected from the invocation

Depth tokens:

- Minimal: `minimal`, `fast`, `quick`, `--minimal`, `-m`
- Detailed: `detailed`, `deep`, `full`, `--detailed`, `-d`

If the user does not specify depth, choose a practical default based on source size: concise for short sources, section-by-section for long sources. Do not block on a depth prompt unless the user's goal is ambiguous.

## Extraction

Prefer direct access through available tools first. If local CLI extraction is needed, verify the tool exists before using it and explain missing tools clearly.

Useful extractors:

- YouTube or podcast metadata/subtitles: `yt-dlp`
- Web article extraction: `defuddle`
- PDF text extraction: `pdftotext`
- EPUB or DOCX conversion: `pandoc`
- Audio transcription fallback: `mlx_whisper` or another available transcription path

Never install dependencies without asking. If extraction is not possible, explain what is missing and give the user the smallest next step.

## Summary Depth

Make summary length proportional to the source, not generic.

| Source Size | Target Output |
|---|---|
| Under 1,500 words | 200-400 words, 1-2 sections |
| 1,500-5,000 words | 500-1,200 words, 3-5 sections |
| 5,000-15,000 words | 1,500-3,000 words, 5-8 sections |
| 15,000-40,000 words | 3,000-6,000 words, 8-15 sections |
| 40,000+ words | Long-form summary with chapter/section treatment |

For videos and podcasts, estimate around 120-170 spoken words per minute if transcript word count is unavailable.

For books, preserve chapter structure when possible. Each important chapter should get its own section with the core argument, evidence, examples, and memorable quotes.

## Output Format

Default to this shape:

```markdown
**Source**
- Title: ...
- Creator/author: ...
- URL/file: ...
- Date/duration: ...

**TLDR**
2-5 sentences proportional to the source.

**Key Takeaways**
- ...
- ...
- ...

**Detailed Summary**

## Section Title
Summary paragraphs.

## Section Title
Summary paragraphs.

**Notable Quotes**
> "..." - Speaker/source location

**Open Questions / Follow-Ups**
- ...
```

Omit sections that do not apply. For minimal mode, prefer `TLDR`, `Key Takeaways`, and a compact summary. For detailed mode, include richer section-by-section analysis, quotes, and caveats.

## Style Rules

- Respond in the language of the user's request, not automatically in the source language. If the source is in another language, summarize it in the request language unless the user explicitly asks to preserve or translate into a different language.
- Do not use Obsidian wikilinks unless the user asks for Obsidian-compatible Markdown.
- Do not invent metadata, quotes, or citations. Mark unknown fields as unknown or omit them.
- Explain technical terms inline for general readers.
- For expert audiences, focus on novel claims, mechanisms, tradeoffs, and critiques.
- Preserve source nuance. Separate what the source claims from your own analysis.
- If the source is long, use parallel subagents when available to summarize independent sections, then synthesize.

## File Output

Default behavior is chat output only. If the user explicitly asks to save a file, ask for or infer a destination, then write a single Markdown summary file. Do not create vault structures or companion notes.
