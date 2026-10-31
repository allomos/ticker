# AGENTS.md

Shared rules for every AI agent working on this project.

## Tasks: Allomos (v29)

This project's tasks, progress and handoff notes live in Allomos's taskbag
(`.allomos/taskbag/`). Work them with the `alm` command; never edit those files by hand, except
the project notes (below).

- Start a session with `alm next` (every ready task nobody holds, each with its handoff note, and the
  rule for choosing; `--iteration <id>` for one iteration; then the project notes' Running and
  Pitfalls), or `alm list`.
- Take a task: get the latest changes first, then `alm claim <id> --as <your session name>
  --branch <the branch you are on>` (as your version control tool shows it; in Git:
  `git branch --show-current`), and save and share the claim right away with your version
  control tool (it prints the Git commands as the example): until your claim is shared, other
  sessions do not see it. Every task has a base branch, by its real name: it starts from it and
  merges back into it; the claim records your working branch and prints the base to start from
  and merge into, with the Git commands as the example. When you claim, pass what the Allomos
  app needs to reopen your session: `--session-agent <your agent's id>`, `--session-id <your
  session's ID>`, and whatever else your agent needs to reopen it (for example,
  `--session-kind desktop --app-session-id <its local_… ID>` when you run in the Claude
  desktop app). After a command that changes a task, `alm` lists what the task is still missing
  (session details, working branch, a handoff note), each with the command that fixes it; run
  it (session details: `alm session <id> --session-agent … --session-id …`).
- Always work a task in a worktree of its own (a separate working copy on the task's own
  branch; in Git: `git worktree add <folder> -b <working branch> <base>`, which the claim
  prints), never in the main checkout: the main checkout stays on the base branch. Merge from
  the main checkout; once merged, remove your worktree and the merged branch.
- Report progress: `alm label <id> "<label>"`.
- Stopped: waiting on a person: `alm wait <id> --on "<what>" [--who "<who>"]`; blocked by
  another task: `alm block <id> --by <task-id>`. `alm next` says when all blockers are done;
  then check and move it on: `alm unblock <id>`.
- Stopping before it is done: `alm release <id> --note "<what the next one needs>"`.
- Before an automatic or loop run begins (a card run, `/loop`, several tasks one after
  another), ask the person to choose quiet or normal mode: show them what
  `alm guide run-modes` prints (in the task language), as it is, and do not start until they
  choose. Write the choice in your handoff ("Run mode: quiet" or "Run mode: normal", who
  chose it and when) and follow it until the run ends. In normal mode, ask as usual.
- Goal run: when the person gives you a goal (an app to build from their description), follow
  what `alm guide goal` prints (in the task language). Submitting the goal approved the plan in
  advance, recorded once on the goal task (its title starts with `Goal:`): you add the areas and
  iterations and make your own tasks ready. Anything with an outside effect still waits for the
  approver. No spend cap: the quota gate of `alm handoff-rules` is the limit.
- A line in the conversation that starts with `alm ` followed by one of its commands (for example
  `alm guide github release`) is a command: run it as written, and when it prints a guide, follow
  that guide. The word alm inside a sentence is not one.
- Finished: at the top label (a person has checked it: the human check): `alm done <id>`.
  When the work is finished and only a person's hands-on check is left, in quiet and normal
  mode alike, finish it below the top label with `alm done <id> --without-human-check "<why>"
  --steps <file.md>` (the steps tell a person how to check it; it shows as done, to check, in
  `alm human`); say so in your handoff. Do not leave such a task waiting: `alm wait` is only for
  a real question, an approval or an outside effect.
  In an automatic or loop run the person set up to go on without them (a quiet run), never
  stop to wait for the person: decide a routine choice yourself (below); park a real question
  with `alm wait <id> --on "<the question>"` (it shows in `alm human`, To answer) and go on
  with the next ready task; do not use `alm confirm` (it would wait until it times out).
- Needs a human: `alm human` lists the tasks to check, to answer and to review. When the person
  says they checked one: `alm checked <id>`. When its work changes after that, you decide: send
  it back to To check with `alm recheck <id> --reason "<what changed>"`.
- Approvals: ask the person in the conversation. Only on a job the person gave you from the
  Allomos app (they do not see your conversation) ask with `alm confirm`, showing the evidence
  (`--evidence <file.md>`) and naming the task (`--task <id>`); in a quiet run, `alm wait`
  instead. A Go ahead covers only the plan shown; if the plan changes afterwards, ask again.
- Routine choices inside a task (a name, a file layout, how something is built inside the task, a
  small detail with an obvious default; anything cheap to undo) are yours: decide, carry on, and
  record each one with `alm ai-decided <id> "<what and why>"`, so the approver can review it
  later (`alm human`, To review: AI decisions). When they say they reviewed them:
  `alm reviewed <id>`. What users will see and get used to, anything hard to undo (data formats,
  removing things), anything that changes the plan or another task, and anything with a cost or
  an outside effect goes to the approver first.
- Adding a task: every new piece of work (a new card, a new outcome) gets its own task. Read
  `alm guide tasks` first, then `alm add task --area <area> --title "<outcome>" --branch
  <the branch you are on>`: on a task's working branch, the new task shares that task's base;
  otherwise the base is the branch you are on. alm prints which and why; `--base` overrides it.
  When the taskbag has project folders (several folders, each with its own AGENTS.md), decide
  which ones the task belongs to, or none, and say so: `--folder <name>` (repeatable) or
  `--no-folder`; alm does not guess. `alm folders <id> <name>…` (or `--none`) changes them later.
  Run inside a project folder, `alm next` lists only that folder's tasks (`--all-folders`: every
  task).
- Change a task's title, description or handoff note: `alm title <id> "<title>"`,
  `alm describe <id> --text "<markdown>"` (or `--from <file.md>`), `alm note <id> "<text>"`.
- Before adding a task or changing its title or description, run `alm task-language` and write in
  that language.
- Card files: a task's card file (its detail in a file of its own) lives beside the task in the
  taskbag, as `tasks/<id>/card.md`, and the description's `Card:` link points to it. If tasks
  link to card files outside the taskbag, report them with `alm cards found <id>=<path>` and
  propose moving them in, following `alm guide move-cards`; the person can also start it with
  **Update the taskbag…** in the Allomos app (`alm move-in` prints that request).
- Handoff: `alm handoff-rules` says when to write one (quota and context gates). The gates apply
  only while you hold a task (from `alm claim` until `alm done` or `alm release`); reaching one,
  write the handoff, then release the task (`alm release <id> --note`, naming the working branch),
  so it is ready again for the next session or loop run, which continues on that branch. A
  handoff is written into each task, for any reader, agent or person: `alm handoff <id> --as <your session
  name> --text "<where it stopped, the one next step, who it waits on>"` (or `--from <file.md>`)
  replaces the task's handoff note; `--evidence "<what>"` adds what was done that must not run
  twice (an outside effect) under its description's Evidence; several tasks: once for each.
  Whoever continues reads it with `alm next` or `alm show <id>`. There are no handoff files: if
  `alm next` finds old ones in the taskbag's `handoffs/`, the taskbag needs updating (**Update
  the taskbag…** in the Allomos app, or `alm move-in`).
- Quota: each time you read your usage (in Claude Code: `get_usage`), at the handoff gate's check
  and whenever `alm` asks, report the figure with `alm quota --agent <your agent's id, e.g.
  claude-code or codex> --left <percent> [--resets <local date and time>] [--account <name, only
  if you can tell one; never an email>]`; the Allomos app shows it beside the agent. `alm claim`,
  `alm label`, `alm release`, `alm done` and `alm handoff` ask for it when your last report is
  missing or 30 minutes old or more: read your usage then and report it. It stays on this
  computer: nothing to share.

Shared rules: every AI agent on this project follows one set of shared rules, in AGENTS.md.
- Shared rules live only in AGENTS.md; never add a shared rule to one agent's own file (such as
  CLAUDE.md, GEMINI.md or `.cursor/rules/`), which only points to AGENTS.md and holds what is
  that agent's alone.
- If you are an agent not listed under `## Agents set up` in the project notes, or your own rule
  file does not point to AGENTS.md, run `alm guide agent-files` and do it once for yourself
  before other work.
- After changing shared rules, tell the person which running sessions still use the old ones
  (from the taskbag's holders, `alm list --state in_progress`, and your version control tool's
  working copies; in Git: `git worktree list`).

Project notes: the taskbag's `project-notes.md` holds what every session must know whatever its
task: what is running, pitfalls, where credentials live (never their values). Read it at the
start (`alm next` shows its Running and Pitfalls). Unlike the other taskbag files, you edit it
directly, and you keep it true while you work: update it when you start
or stop a server or process, create or change a hosted resource or a remote repository, learn a
pitfall that would change what the next session does, or a credential moves. Change lines in
place and remove lines that are no longer true; then save and share that file with your version
control tool yourself.
Personal details are kept out like credentials: never write a person's or an account's email
address, account or user name, phone number, home address or local network address into the
project notes, a handoff, a task, a document or the code. Write a placeholder such as
`<CLOUDFLARE_ACCOUNT_EMAIL>` and how to look it up (for example `npx wrangler whoami`) instead;
version history keeps whatever was written, even after it is removed.

`alm` never runs your version control tool. After every change it lists the changed files for
you to save and share with your version control tool, with the Git commands as the example
(`git add`, `git commit`, `git push`), naming only that change's files: save and share those,
and leave other changes as they are.

Allomos relies on these terms: **area** (what part of the product a task belongs to),
**iteration** (when it is planned), **label** (the step of this project's progress ladder a task
has proven) and **state** (backlog, ready, in progress, waiting, blocked, done, dropped). When
you need more, ask `alm` rather than guessing: `alm guide terms` (what they mean),
`alm guide customize` (what this project may change and what is fixed), `alm guide commands`,
`alm guide workflow`, `alm guide run-modes` (quiet or normal mode, for the person),
`alm guide agent-files` (one set of shared rules for every agent, done once per agent),
`alm guide goal` (the goal prompt: build an app from a description, release by release),
`alm guide github-release` (publish a GitHub release and install it, when the approver asks),
`alm guide move-cards` (card files: moving them in beside their tasks).
