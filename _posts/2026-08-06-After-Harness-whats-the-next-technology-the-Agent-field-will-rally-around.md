---
title: "After Harness, what's the next technology the Agent field will rally around?"
date: 2026-08-06
source: https://x.com/Simonsterrific/status/2085368493550252071
source_id: "2085368493550252071"
tags: [X Article]
---

![Cover](assets/x-articles/2085368493550252071-cover.jpg)

Most likely: a distributed runtime plus a distributed memory system.

The real significance of Harness was never the tool-calling itself. The moment it appeared, people were bound to ask: now that an LLM can run — via a glue-layer framework — either locally or in the cloud, is there a way to let a single agent run across both local and cloud environments at once, collaborating to finish a very long-running task?

Take it a step further: can I run many context-sharing agent instances in parallel, across countless isolated environments, to accomplish work that would otherwise take months or even years?

![Vision sketch: agent instances in countless isolated environments sharing context and collaborating in parallel.](https://pbs.twimg.com/media/HOztLI2bcAEtoLU.jpg)

That points to the first practical problem: an agent needs a stable, isolated, elastically scalable runtime environment. And the technology underpinning all of this — cloud computing, containers, and so on — already existed well before the GenAI explosion of 2022.

The survey¹ released this year by CMU, Yale, and Amazon puts it bluntly — "The harness is becoming the binding constraint" — the runtime framework is becoming the bottleneck constraining agent capability, not the underlying model itself.

![Screenshot of the "binding constraint" argument from "Agent Harness Engineering: A Survey" (CMU / Yale / Amazon et al.).](https://pbs.twimg.com/media/HOztV9PacAA2Rhg.jpg)

They surveyed open-source projects from 2022 to 2026 and distilled the ETCLOVG seven-layer taxonomy. The E layer (Execution environment & sandbox) already has ~20 major projects — it's the most mature part of the infrastructure stack. But the genuinely interesting part is the C layer — Context and memory management — which is almost the thinnest in the open-source community, with very few independently released components; it's more often embedded inside frameworks as a side feature.

![The ETCLOVG seven-layer taxonomy: the E layer (execution environment) is most mature, the C layer (context & memory) is weakest.](https://pbs.twimg.com/media/HOzteZDaUAAvPeH.jpg)

The most mature layer and the thinnest layer are, in fact, two sides of the same coin.

Think about why. The execution environment answers where the agent runs; the memory system answers what the agent remembers. You give an agent a cloud computer — it can write code, browse the web, manipulate the file system — but the moment the task ends, that computer is destroyed. Next launch, it starts from zero. It's like giving a person a brand-new office every single day: every note, file, and desktop layout wiped clean, only a résumé preserved. They can still work, but they can never accumulate experience.

E2B's data² already confirms this trend. From 2024 to 2025, the average sandbox runtime grew more than 10x. That means agents are moving from short tasks that finish in minutes to long-running tasks that span hours.

![E2B chart: average sandbox session duration grew 10x+ from 2024 to 2025.](https://pbs.twimg.com/media/HOztoGRbgAAA_GZ.jpg)

Whether it was last year's Manus or the various recent domestic "Claw" cloud instances, they're essentially simulating a complete human workflow inside a virtual machine. The sandbox has gone from a throwaway tool to a long-term workspace — but the memory system hasn't kept pace. For example, I tried a Claw that worked inside a cloud sandbox for several hours, producing a mountain of intermediate state, reasoning, and error-correction logs. Then I pulled that stage's output down to my local machine to continue. The only stimulus signal the agent received was my newly typed prompt.

Because even though I had a Memory-related Skill installed, that memory data only lived in that cloud environment — my local agent couldn't access it. This is exactly why models like Lobster and Hermès — which combine multiple information channels with a single runtime environment — have become the lowest-friction option for context exchange.

That's why I say the next technology people rally around must be the combination of a distributed runtime and a distributed memory system, not either one alone.

Look at distributed runtime on its own, and it's already exploding.

E2B grew from a handful of users to serving roughly 50% of Fortune 500 companies, spinning up millions of sandboxes every week². Browserbase reached a $300 million valuation in under two years³. Tencent Cloud open-sourced CubeSandbox this April — built on RustVMM and KVM, with sub-60-millisecond cold starts, about 5MB of memory per sandbox, and native compatibility with E2B's SDK⁴ — you only swap one environment variable to route traffic to a self-hosted cluster.

That compatibility means the lock-in tax across the entire agent infrastructure space just got smaller. Assume you start on E2B's hosted service; when the bill spikes or compliance asks for data residency, migrating environments is a one-line URL change.

But the sandbox itself solves isolation and elasticity — not continuity.

Continuity needs a memory system. And memory is far harder than most people imagine.

A lot of people think an agent's memory is just dumping the conversation history into a vector database or a local Markdown file, then recalling it next session. That's the shallowest layer. A real distributed memory system has to solve three levels — each an order of magnitude harder than the last.

Level one is persistence. An agent works for two hours in sandbox A; when sandbox B launches next time, it needs seamless access to the previous work state. That's not just saving files — it's preserving the entire working context: which paths were already explored, which decisions were already made, which errors were already fixed.

MemGPT (now called Letta)⁵ was among the first to tackle this. Its core idea is to give the agent a self-managed memory hierarchy — like an OS's virtual memory — letting the agent itself decide what stays in main memory and what gets swapped out to external storage. But MemGPT still solved memory for a single agent in a single environment.

Level two is sharing. When multiple agents collaborate, they need a mechanism to share and synchronize their memories. A research agent discovers key information; a coding agent needs it in real time; a testing agent needs to know the coding agent's design decisions.

It's like the state-synchronization problem in distributed systems — but harder, because an agent's memory isn't structured key-value pairs; it's semi-structured natural-language reasoning chains, decision trees, and experience fragments. You can't sync those with the Raft protocol.

Level three is evolution. An agent's memory isn't a static snapshot; it's a living system that must be continuously refined and compressed over time. An agent that's run a thousand tasks shouldn't keep a thousand raw records — it should distill patterns, rules, and preferences from them.

The "dreaming" mechanism⁶ in CC (Claude Code) opened a door here: an agent's memory system needs this self-refinement capability, otherwise memory inflates without bound and eventually drags the whole system down. But no dreaming mechanism today crosses environments to achieve system-level memory awareness.

The runtime is the agent's body; the memory system is its soul. A soul without a body is a wandering ghost; a body without a soul is an idling machine.

![Metaphor illustration: "runtime is the body, memory is the soul."](https://pbs.twimg.com/media/HOztw51bEAA8X7V.jpg)

The shift from Agent Frameworks to Agent Platforms is, at its core, the shift from giving an agent a local abstraction to giving it a persistent living space.

A Framework provides conceptual abstractions — Agent, Tools, Memory, Execution Loop. A Platform provides a persistent workspace, identity, observability, evaluation, governance, and human handoff across runs and across users. The core driver of this shift is that the agent must evolve from a one-shot task executor into a long-lived digital worker.

And to make a digital worker persist, you must solve both where it runs and what it remembers. Solving either one alone is only half a solution.

There's a deeper reason these two technologies must arrive bound together.

A distributed runtime is inherently multi-instance. An agent may launch different sandboxes at different times; different agents may run simultaneously in different sandboxes. This means memory must detach from any single runtime instance and become an independent service accessible by any instance. Conversely, a distributed memory system also needs a runtime to carry its read and write operations — memory doesn't exist in a vacuum; it is always produced and consumed within some concrete execution context.

The two form a closed loop: the runtime produces memory, memory guides behavior in the runtime, and behavior produces new memory.

Once that loop is established, the agent truly gains the ability to "grow." It's no longer a reasoning engine restarting from zero every time, but a persistent being with experience, preferences, and judgment. This is the real qualitative leap the Agent field is waiting for — not a slightly smarter model, not a few more tools, but an agent that can finally, like a living thing, accumulate irreplaceable individual experience through repeated interaction with its environment.

![Analogy sketch: the absence of "persistent memory" in the Agent space, compared to AWS EBS.](https://pbs.twimg.com/media/HOzt4iOaoAAbQ8Q.jpg)

Here's an analogy that captures the urgency.

Today's agent ecosystem is like early cloud computing — everyone debated VM specs and pricing, but almost nobody discussed persistent storage. Then AWS launched EBS (Elastic Block Store), and VMs could finally mount a disk that didn't vanish when the instance terminated; only then did cloud computing turn from ephemeral compute into dependable production infrastructure. E2B and CubeSandbox are playing the role of early EC2 — but the agent space's EBS hasn't arrived yet.

When the runtime can already do 80-millisecond cold starts, 5MB memory footprints, and 24-hour long sessions, yet the memory system is still stuck at "toss the chat log into a vector database" or "write it to some local Markdown file," that gap itself is the signal of the next technological explosion.

The bigger the gap, the greater the potential energy. This absence won't last long, because the demand-side pressure is already crystal clear: agent runtime has grown 10x, long-running tasks need long-term memory, multi-agent collaboration needs shared memory — three unavoidable, hard requirements.

## Sources

[1] Junjie Li, Xi Xiao, et al. (CMU / Yale / Amazon et al.), Agent Harness Engineering: A Survey — proposes the ETCLOVG seven-layer taxonomy and the "binding constraint" thesis: the runtime framework, not the underlying model, is becoming the bottleneck on agent capability. [https://www.daoyuly.cn/2026/Agent_Harness_Engineering_A_Survey](https://www.daoyuly.cn/2026/Agent_Harness_Engineering_A_Survey) ｜ Full text on OpenReview: [https://openreview.net/pdf/f358711a95aaaf61fdeffd4ef3fc60fba9b8da57.pdf](https://openreview.net/pdf/f358711a95aaaf61fdeffd4ef3fc60fba9b8da57.pdf)

[2] Yizhen Dai (E2B), The Evolution of Agent Architecture: From "Hardcoded Pipelines" to "Defining Boundaries" — discloses that E2B's average sandbox session runtime grew 10x+ from 2024 to 2025, and that it is already adopted by most Fortune 500 companies. [https://www.linkedin.com/pulse/evolution-agent-architecture-from-hardcoded-pipelines-yizhen-dai-frdyc](https://www.linkedin.com/pulse/evolution-agent-architecture-from-hardcoded-pipelines-yizhen-dai-frdyc)

[3] Browserbase, Browserbase Raises 40M… valued at 300 million — founded in 2024, reached a $300M valuation in under two years, serving 1,000+ enterprise customers. [https://www.upstartsmedia.com/p/browserbase-raises-40m-and-launches-director](https://www.upstartsmedia.com/p/browserbase-raises-40m-and-launches-director)

[4] Tencent CubeSandbox, Introduction — built on RustVMM + KVM, sub-60ms cold start, under 5MB memory per instance, native E2B SDK compatibility. [https://docs.cubesandbox.ai/guide/introduction.html](https://docs.cubesandbox.ai/guide/introduction.html)

[5] Charles Packer et al. (UC Berkeley), MemGPT: Towards LLMs as Operating Systems (arXiv:2310.08560) — proposes virtual context management, letting a single agent self-manage its memory hierarchy like OS paging; MemGPT is the predecessor of Letta. [https://arxiv.org/abs/2310.08560](https://arxiv.org/abs/2310.08560) ｜ [https://research.memgpt.ai/](https://research.memgpt.ai/)

[6] Anthropic, New in Claude Managed Agents: dreaming, outcomes, and multiagent orchestration — officially releases the "dreaming" mechanism, which reviews and refines memory between sessions so the agent self-improves across sessions. [https://claude.com/blog/new-in-claude-managed-agents](https://claude.com/blog/new-in-claude-managed-agents)

---

_Originally published on [X](https://x.com/Simonsterrific/status/2085368493550252071)._
