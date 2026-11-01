---
title: "Claude Code Mod VS DeepSeek Plugins"
date: 2026-10-03
source: https://x.com/Simonsterrific/status/2106408823531708557
source_id: "2106408823531708557"
tags: [X Article]
---

![Cover](assets/x-articles/2106408823531708557-cover.jpg)

On October 1, Anthropic shipped Mods in Claude Code 2.1.287, on by default with no feature flag¹. 

Boris Cherny posted the same day: 

> "Mods are absolutely insane. You can now customize Claude to work and look the way you want by just prompting it. Each person works differently, so there's no reason why everyone should have an identical Claude experience."² 

Cui Tianyi, who leads the DeepSeek Harness team, replied underneath, in a light tone: a "cute way to make your agent harness extensible and customizable." Then the line that got screenshotted everywhere: "So we've been thinking about the term Plugin.Engineering for a while... Or should it be Mod.Engineering now?"³

![Tianyi Cui's post, using the phrases "mods are just plugins" and "A cute way," quoting Boris Cherny's announcement.](https://pbs.twimg.com/media/HTtxFkzacAAmEFs.jpg)

Most people read this as two executives being polite to each other. It is the single densest sentence in this launch, because in the same post he finished the comparison: in Claude Code, mods are just plugins, while DeepSeek Harness has been built around rethinking the plugin concept from the very beginning. His English is blunter than the Chinese translation: a subset of Claude Code features are made available as mods, versus everything is a plugin.

Subset and everything are different orders of magnitude.

A mod is a JavaScript or TypeScript file running inside a Claude Code session, exporting register(on, options) and attaching handlers via on(event, matcher?, hook). 

Each handler gets three arguments: 

1. $, the API surface; 

2. e, the event payload; 

3. and next, which passes the event along the chain. 

A handler can observe, rewrite, or answer, and answering means never calling next at all, which is how you say no¹.

None of those verbs are new. What is new is that they run in-process, and that a mod holds render rights over the terminal.

This is the actual dividing line: extension went from out-of-process calls to in-process interception.

Before Mods, the extension surface was three disconnected channels: MCP exposes tools out of process, Skills are pure prompt text, and Settings Hooks spawn an external subprocess to run shell. An external script cannot see runtime intermediate state and cannot repaint the terminal. Mods collapse all three onto one hook chain.

So of the three things Mods can change, behavior, interface, and built-in features, which one actually got productized? The three official examples point somewhere counterintuitive.

![Token Weather drawing context occupancy as weather: Clear at 18%, Showers at 67%, Storm at 81%. The shortest of the official examples, roughly 80 lines according to Addy Osmani. Source: The New Stack](https://pbs.twimg.com/tweet_video_thumb/HTtxdPKbQAAYOM1.jpg)

Token Weather draws context occupancy. Replay Theater steps through the diff of the last turn. Blast Radius holds rm -rf and force pushes and shows you the blast area first. Two and a half of those three are visualization.

Mods mostly close an observability gap, not a capability gap. The interface layer of an agent harness has always been a black box: how many tokens the model read, which files this turn changed, how much a command is about to destroy. The user cannot see any of it and can only guess. Mods open the interface layer, and they open it cheaply.

The comparison makes this sharper. Before Mods, Anthropic already had mature Settings Hooks that could run shell before a tool call and return a permission decision. 

So why take on the permission risk of an unsandboxed in-process version? There is exactly one answer: Settings Hooks cannot draw. Blast Radius opens a pane on the right of the terminal, runs git status, git clean -n and git log HEAD..origin/main inside it, and waits for you to press 1 or 2. Token Weather wants a sparkline in the empty band above the prompt, a band that exists precisely because nothing was drawn there yet.

The first mod worth engineering is the one that draws what was invisible. It is the only kind of change where the user can immediately tell whether they came out ahead.

Now the detail almost nobody mentions, which is also the most revealing. On the same day it opened mods, Anthropic put a directory called mods/ in its own repository, and inside it sat sec-default⁴. The same directory holds agents-md and diff. Anthropic admits that AGENTS.md support and the /diff pane are themselves mods.

The sec-default README is explicit: users' plugins sit in the user tier, beneath the organization's prepend tier and above its append tier. This built-in mod sits outermost. It has three moves and adds no policy of its own: continue past the user tier, refuse a user-tier caller or module by name, or pass. If reading the policy fails, it fails closed, so an unreadable policy counts as a policy in force⁵.

Translated: on the same day it opened mods, Anthropic turned the organizational trust root into a mod, and made it the one checkpoint every install has to pass through.

![One deployment running 159 plugins, including llm, session, typert-loader, api-gateway and session-title, none of which look like a "plugin" in the usual sense. Source: InfoQ](https://pbs.twimg.com/media/HTtxqq3bsAA8BNL.jpg)

Look at that last name. session-title is session title generation. In someone else's architecture that is product logic. In DSH it is a plugin you can disable and replace on its own.

This is what everything is a plugin actually means: not "supports plugins," but "there is nothing that cannot be replaced."

The official architecture document is blunter than any marketing line: "There is no privileged core to patch: you extend dsh by mounting a plugin beside the others, and registrations are effects that unwind when their plugin unloads." The same file lists what is a plugin: the model adapter, the tool registry, the session log, and the agent loop itself⁶. If you want to change how the agent steps, you do not open an issue and wait for a hook. You swap the loop.

![Illustration: the subset-versus-everything gap Tianyi Cui pointed at](https://pbs.twimg.com/media/HTtypWcb0AAYZQu.png)

The corollary is the tier system, which is the part Anthropic ships and DeepSeek does not.

![](https://pbs.twimg.com/media/HTty10VagAAGCqp.png)

Mods are not "a nice little visualization for terminal users." They are the move from a product to a platform, and the first step of platformizing is not opening, it is deciding who gets to touch what.

And the thing nobody sees coming: this is not a sandbox. Anthropic's own documentation says a mod runs at the same machine permission level as Claude Code, is not sandboxed, and should only be installed from sources you trust⁷. Turning on sandboxing isolates the Bash commands Claude runs, not a process a mod starts.

The real second half of "there's no reason why everyone should have an identical Claude" is: who decides which changes are allowed onto my machine.

Which is also why "Mod" is the more accurate name. Mod is the word from game modding workshops; Plugin is the word from Eclipse and VS Code. The first assumes you own the consequences of what you install, the second assumes someone reviewed it before it shipped. Choosing Mod pushes review responsibility onto the user. sec-default is the exception, and the exception is exactly where the boundary is.

Now DeepSeek. And here is where the plugin ecosystem question actually gets decided, which is not in the launch post at all.

The paper released alongside Harness is the real thing. "A Programming Paradigm for Spatiotemporal Composability," by Yifan Shi, Wei Zhang and Tianyi Cui, preprint 13 August 2026⁸. The problem, in one sentence: you installed a plugin, it registered listeners, allocated resources and mutated global state, and now you want to uninstall it. How do you restore the environment exactly?

The state of the art, per the paper: of VS Code's top 100 extensions, 87 contain executable code and unloading them requires restarting the entire extension host. Only 7 declare an extension dependency⁹. The most successful plugin system in the world has conceded on both dynamic unload and dependency management. Everyone's answer is "restart."

![Illustration: loading a plugin is the easy half; the half that kills ecosystems is taking it back out.](https://pbs.twimg.com/media/HTtzd4kagAADshD.jpg)

Cordis splits the fix in two. The time dimension is revertible effects: every operation records its inverse at execution time, and unloading replays them in reverse so the context returns to exactly its prior state. The space dimension is reactive coeffects: a component declares the services it needs, and the runtime classifies context changes as activating, deactivating or neutral, so a missing dependency deactivates the component instead of leaving it holding a null reference. The paper proves a confluence property: the final state depends only on the final set of components, not on the order they were loaded or reloaded in⁸.

This is the one place DSH has something Claude Code does not, and it is not a feature list, it is a proof. Plugin ecosystems do not die because nobody can write one. They die like this: you write one, three months later the host ships a breaking change, everything breaks, and the authors leave one by one. That is the fate of every plugin ecosystem, unless the framework turns unload correctness into a structural guarantee instead of something each author has to remember.

Worth noting where Cordis came from. It was not built for agents. It grew out of Koishi, a chatbot framework with more than 4,000 community plugins and four years of production use⁸. DeepSeek picked up a foundation that has already been hit by four years of real ecosystem.

And Creator Mode is the part of this conversation that got skipped. Harness ships four presets, and the fourth lets you prompt the agent to inspect the live runtime, write Cordis plugins in memory, hot-mount them in a sandbox, and persist the ones that work, so you can build a new preset out of them¹⁰.

Claude Code's Mods are peripherals that human engineers bolt onto an agent. DSH's Creator Mode lets the agent rewrite its own organs and its own execution logic at runtime. That is not a difference of degree, it is a difference of category.

![Illustration: the three questions to ask before adopting any agent plugin mechanism.](https://pbs.twimg.com/media/HTtzpquawAESyib.png)

So the renaming joke is not a joke.

Mod Engineering is a craft: write a TypeScript file, attach it to an event, change behavior, draw the interface, package it as a plugin, share it. The entry barrier is now "just prompt it," and Cherny is not exaggerating, because the official Token Weather sample was built exactly that way¹.

Plugin Engineering is a different craft: swap one of 159 components in a running system and guarantee the other 158 do not break, with that guarantee coming from the type system rather than from your memory to write dispose every time.

The moment the marginal cost of writing a plugin collapses to one sentence, the moat has to move from "can this code be written" to "where does it come from" and "who answers for it. The first is distribution, the second is a trust root. Anthropic shipped marketplace and sec-default in the same breath, which is it grabbing both. DeepSeek has distribution on GitHub and a paper standing in for a trust root. Harness has been open for about a month and a half, and as of yesterday's check the repository sits at 242,551 stars and 29,078 forks, created 13 August¹¹. When v0.2 shipped on 29 September, DeepSeek said about 60% of Harness users counted among users of its official model API already run third-party plugins¹⁰.

Those two numbers together are the actual competitive position. Anthropic has larger distribution and a stronger brand. DeepSeek has a more complete open architecture and a formally proven uninstall path. Neither company wins on what the mod is called.

On plugin standardization, which is the thing everyone hopes for: it will not happen soon, and not happening is the better outcome. What the two sides are competing over is not the format, it is control of the runtime. The hook event names and the $ namespace are explicitly Anthropic's, and the docs say the API may change between releases, while Cordis has 350 projects depending on it. If the two actually unified, one of them would be handing over its architectural advantage. Formats converge; semantics do not, because semantics is where the answer to "who owns this agent" lives.

So the next time some agent ships a plugin mechanism, do not ask whether it should be called a mod. Ask three questions. Are extension points tiered with a trust root that fails closed? Is unload a structural guarantee or the author's memory? How many days does it take a plugin author to ship a fix after a breaking core release? Two "no" answers out of three and that plugin system becomes the next Emacs load-theme directory: loud for a quarter, then...

## Sources

[1] Addy Osmani, "Getting started with Claude Code mods," claude.dev, 1 October 2026 — mod definition, the register(on, options) shape, the three handler arguments, observe/rewrite/answer, generated type declarations, the ~80-line Token Weather, and the note that AGENTS.md support and the /diff pane are mods. [https://claude.dev/blog/getting-started-with-claude-code-mods/](https://claude.dev/blog/getting-started-with-claude-code-mods/) | [https://code.claude.com/docs/en/plugins/mods](https://code.claude.com/docs/en/plugins/mods)

[2] @bcherny, "Mods are absolutely insane. You can now customize Claude to work and look the way you want by just prompting it," 1 October 2026 — the product thesis that customization should be promptable and shareable as plugins. [https://x.com/bcherny/status/2105756563302723721](https://x.com/bcherny/status/2105756563302723721)

[3] @tianyi (Tianyi Cui, DeepSeek Harness), post replying to @bcherny, 2 October 2026 — "a cute way to make your agent harness extensible," "mods are just plugins," subset versus everything, and the Plugin.Engineering to Mod.Engineering joke. The post is quoted verbatim and screenshotted in the figure above; the text is also carried by [https://rss.bz/post/deepseek-harness-modular-claude-code-mods](https://rss.bz/post/deepseek-harness-modular-claude-code-mods). Profile: [https://x.com/tianyi](https://x.com/tianyi)

[4] anthropics/claude-code, mods/ directory — the shipped built-in mods are agents-md, diff, sec-default and telemetry, confirming built-in features are implemented as mods. [https://github.com/anthropics/claude-code/tree/main/mods](https://github.com/anthropics/claude-code/tree/main/mods)

[5] anthropics/claude-code, "sec-default" README — the user / prepend / append tier model, the three moves with no added policy, e.provider and e.tier provenance, and fail-closed policy reads. [https://github.com/anthropics/claude-code/blob/main/mods/sec-default/README.md](https://github.com/anthropics/claude-code/blob/main/mods/sec-default/README.md)

[6] DeepSeek, "DeepSeek Harness Architecture" (docs/architecture.md) — "There is no privileged core to patch," the plugin list including the model adapter, tool registry, session log and agent loop, and the profile/bundle layering. [https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)

[7] Claude Code documentation, "Mods" and admin guides — mods run at the same permission level as Claude Code, are not sandboxed, and sandboxing does not cover processes a mod starts; the claude plugin validate dry run. [https://code.claude.com/docs/en/plugins/mods](https://code.claude.com/docs/en/plugins/mods) | [https://code.claude.com/docs/en/plugins/mods/admin](https://code.claude.com/docs/en/plugins/mods/admin)

[8] Yifan Shi, Wei Zhang, Tianyi Cui, "A Programming Paradigm for Spatiotemporal Composability," arXiv:2608.25512, 13 August 2026 — revertible effects, reactive coeffects, the confluence guarantee, the VS Code top-100 extension statistics, and the Koishi case study. [https://arxiv.org/abs/2608.25512](https://arxiv.org/abs/2608.25512)

[9] explainx.ai, "Cordis and Spatiotemporal Composability, Explained" — the plain-language split between loading (easy) and unloading (hard), and Cordis's adoption footprint. [https://explainx.ai/blog/cordis-spatiotemporal-composability-explained-2026](https://explainx.ai/blog/cordis-spatiotemporal-composability-explained-2026)

[10] Pandaily, "DeepSeek Harness v0.2 Preview Adds Desktop Installers, Plugin Manager and Scheduled Automations," 30 September 2026 — the 29 September v0.2 release, the plugin management page, Creation mode, and the ~60% third-party plugin figure counted among users of DeepSeek's official model API. [https://pandaily.com/deepseek-harness-v0-2-preview-desktop-installers-plugin-manager-automations](https://pandaily.com/deepseek-harness-v0-2-preview-desktop-installers-plugin-manager-automations)

[11] GitHub API, repository metadata for deepseek-ai/deepseek-harness — 242,551 stars, 29,078 forks, created 13 August 2026, as read on 3 October 2026. [https://api.github.com/repos/deepseek-ai/deepseek-harness](https://api.github.com/repos/deepseek-ai/deepseek-harness)

[12] The New Stack, "'No reason why everyone should have an identical Claude experience': Anthropic's mods let you change Claude Code's look and behavior," 2 October 2026 — the September 3 "function hooks" preview, the September 14 rename, default-on in 2.1.287, and the Token Weather thresholds. [https://thenewstack.io/anthropic-claude-code-mods-plugins](https://thenewstack.io/anthropic-claude-code-mods-plugins)

[13] Jakub Kontra, "Claude Code mods: what developers, designers, and managers can use them for" — the mod-versus-settings-hook distinction ("a settings hook runs a shell command for each event... a mod is loaded once and stays in the session") and the surface where mod UI actually renders. [https://jakubkontra.com/en/blog/claude-code-mods-for-developers-designers-managers](https://jakubkontra.com/en/blog/claude-code-mods-for-developers-designers-managers)

[14] AlphaSignal, "Anthropic's Claude Code Mods Let Developers Rewrite the Agent From Inside" — the Express-style middleware framing, load-order chaining, the sec-default tier behavior for Team and Enterprise, and Blast Radius's advisory limits. [https://alphasignal.ai/news/anthropic-s-claude-code-mods-let-developers-rewrite-the-agent-from-inside](https://alphasignal.ai/news/anthropic-s-claude-code-mods-let-developers-rewrite-the-agent-from-inside)

[15] OneWave AI, "Claude Code Mods: What They Are, and the Ten We Open-Sourced," 2 October 2026 — building twelve mods in one night, a mod that blocked an rm -rf at 3am, and the failure mode where a throwing hook is skipped silently. [https://www.onewave-ai.com/blog/claude-code-mods](https://www.onewave-ai.com/blog/claude-code-mods)

---

_Originally published on [X](https://x.com/Simonsterrific/status/2106408823531708557)._
