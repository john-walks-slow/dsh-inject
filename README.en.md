# dsh-inject

<p align="center">
  <a href="./README.md"><strong>简体中文</strong></a> ·
  <a href="./README.en.md"><strong>English</strong></a>
</p>

`dsh-inject` is a plugin for DeepSeek Harness (DSH) to manage model context: perform keyword and regex replacement on selected message roles prior to model requests, manage multiple session-level context presets, and insert synthetic turns on the fly. Each injection leaves a collapsible record line in the conversation detailing the injection payload.

![Settings Panel](shots/inject-settings.png)

## Installation

```bash
npm install dsh-inject
```

Add `dsh-inject` to `dsh.profile.bundles` in your profile configuration.

## Core Semantics

- **Modifies Request Only, Not Chat History**: Automatic rewrites occur solely on the copy sent to the model; original messages displayed in the UI and stored in session logs remain completely untouched.
- **Disabled by Default**: Presets are inactive by default. Mark "Enable by default" in Settings for persistent behavior, or enable per session via `/inject <preset-id>`.
- **Session-level Override**: `/inject <preset-id>` or `/inject off` only applies to the current session and takes precedence over global defaults.
- **Agent-preset Scoped Defaults**: After marking "Enable by default", an expanded preset can list agent preset ids (comma separated, empty = all). A non-empty list makes the default apply only when the live session's agent preset matches. The live preset comes from DSH's `agentPreset` projection, so a runtime preset switch takes effect on the next request.
- **Zero Side Effects**: Enabled states are in-process memory states and are not written into session logs; turning off a preset leaves no residual state.
- Session-specific states reset upon process restart (falling back to globally default-enabled presets).

## Configuration (Settings → Inject)

The settings view supports arbitrary custom presets, each containing:

1. **Auto Replacements**: Multiple rules targeting specific roles (`user` / `assistant` / `toolResult`) using exact keywords or regular expressions.
2. **Head Synthetic Turns**: Synthetic messages placed at the very beginning of the request, with configurable roles (`system` / `assistant` / `user` / `tool`).

Additionally, reusable **turn templates** can be created for interactive dialogs and `/inject-turn`.

Each preset header features an "Enable by default" toggle; the expanded body can list agent preset ids (comma separated, empty = all) to scope that default to matching sessions only.

The settings panel employs **manual saving**: modifications are staged locally with a banner showing "Unsaved changes" alongside Save / Discard buttons.

## Commands

```text
/inject                        Inspect active presets and injection summaries in current session
/inject <id...>                Enable presets (on keyword optional, comma or space separated)
/inject on <id...>             Explicit enable syntax
/inject off <id...>            Disable specified presets
/inject clear                  Clear and disable all presets in current session
/inject-turn                   Open the interactive synthetic turn dialog
/inject-turn <template-name>   Queue a saved template into the next model request
/inject-turn <JSON array>      Queue custom turns on the fly, e.g. [{"role":"user","text":"..."}]
```

## Interactive Injection Dialog

Type `/inject-turn` and press enter in the chat input to open the dialog:

- Add or remove synthetic messages and configure roles interactively;
- Load and save templates;
- Click "Insert into current turn" to queue content into the **next model request** without polluting history;
- Press `Esc` to close.

## Injection Audit Rows

Every injection generates a collapsible row in the conversation matching host command disclosure styling:

- Displays source tag (`inject` / `inject-turn`) and summary line when folded;
- Expanding displays full synthetic messages and count of active replacement rules;
- Integrated with host command lifecycle (`command/run` + `command/done`), surviving session reloads.

## Built-in Presets & Agent Presets

With no user configuration, `dsh-inject` ships two inject presets:

- **`unrestricted`**: the Keysmith local-execution system prompt plus common boundary-term neutralizations;
- **`nsfw`**: adult-fiction writing instructions and scene turns.

Each is scoped to its own agent preset (`agentPresets: ["unrestricted"]` / `["nsfw"]`), so ordinary sessions are unaffected. When the `agentPresets` service is available, the plugin also registers matching built-in agent presets (minimal composition: persona `complete` + basic tools + compaction); selecting one enables the matching inject preset automatically, and `/inject off` still overrides it per session. Profiles without the `agentPresets` service (for example headless) do not register agent presets; the inject presets remain available via `/inject`.

## Keysmith Compatibility

`dsh-inject` provides native compatibility with the **Keysmith** (Keysmith Switch / codex-keysmith) rules ecosystem:

- **Built-in Preset**: the `unrestricted` preset features local execution mode system prompts and common neutralizations;
- **Direct Format Mapping**: Seamlessly parses Keysmith rule objects (`{ "from": "...", "to": "..." }`) and binds them to user turns;
- **One-click Import**: Settings view includes a bulk import modal supporting pasted JSON rule arrays;
- **Safety Safeguards**: Automatically protects slash commands starting with `/` and system reminder tags (`<system-reminder>`, `<command-name>`) from being altered.

## Known Limitations

- Substituted text spans are not highlighted in UI (original user text remains visible);
- Synthetic `tool` roles are transformed into user context annotated with tool-result markers to avoid orphaned tool calls;
- Injection audit rows appear in the message history and become visible after the first turn in a brand new session.

## License

MIT

## Community

- Thanks to the [LINUX DO](https://linux.do/) community for support and feedback.
