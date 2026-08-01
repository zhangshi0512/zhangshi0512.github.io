---
title: "Beyond the Agent Hype: Harness Engineering and the Missing Memory Layer"
date: 2026-07-04
source: https://x.com/Simonsterrific/status/2073382538912071874
source_id: "2073382538912071874"
tags: [X Article]
---

![Cover](assets/x-articles/2073382538912071874-cover.jpg)

The way we define AI agents has been a moving target. In 2023, an agent was LLM + Prompt. In 2024, it was LLM + RAG. By 2025, it became LLM + Context & Tool. This year, the equation has finally settled into its most honest form: Agent = LLM + Harness.

A genuinely useful autonomous agent is not just a clever model. It is a system endowed with state management, tool invocation, feedback loops, and enforced constraints. The model is the brain, but Harness Engineering is about controlling the environment in which that brain operates.

![](https://pbs.twimg.com/media/HMYYJPubwAAv38H.jpg)

A complete harness system can be broken down into three interconnected dimensions: Control, Agency, and Runtime—what I call the CAR framework.

Control Layer: Persisting Authoritative Instructions

The control layer defines the agent’s top-level goals, behavioral rules, and authoritative directives. In early applications, these lived in system prompts, but they were vulnerable to “context rot” as conversations grew longer. 

Harness Engineering solves this by converting instructions into persistent control artifacts—files like AGENTS.md or architectural rule sets that reside in a codebase. These files are injected at runtime, ensuring the model cannot violate predefined architectural boundaries no matter how deep it gets into a task. OpenAI’s engineering teams, for example, enforce structural consistency by making Codex parse boundary data with libraries like Zod rather than merely asking the model to behave.

Agency Layer: Mediating Action

The agency layer determines how a model is allowed to act upon the external world. It consists of tool registries, API definitions, and protocols for multi-agent collaboration. 

Rather than letting a model improvise, a well-designed harness decomposes complex business logic into atomic operations and manages their permissions. A system might use an “initialization agent” to set up a workspace and define a blueprint, an “execution agent” to write code, and an “audit agent” for adversarial review. This division of labor isn’t emergent—it’s engineered into the agency structure.

Runtime Layer: Sandboxing the Execution Environment

This is the frontier where the harness touches real data. It manages context lifecycles, filesystem access, sandbox isolation, and network permissions. By providing a virtualized operating system environment, the harness lets the model run code, test, and debug without risking the real world. 

Crucially, the runtime captures physical signals—like standard error output from a failed script—and feeds them back to the model as corrective feedback, which is far more reliable than verbal nudges. Since LLMs are stateless, harness systems often introduce external filesystems (todo.json, progress.md) as the agent’s “external brain,” providing recovery points and a memory archive for both human and machine collaborators.

![](https://pbs.twimg.com/media/HMYYrysawAA43pM.jpg)

At its core, Harness Engineering addresses a profoundly human organizational problem: How do we structure long-term collaboration with a partner that thinks but is fundamentally unstable?

When we used traditional tools like Excel or a calculator, there was never any doubt about who was in control. AI changes that. It understands, generates, drifts, makes mistakes, and can be confidently wrong. You can’t use it like a tool; you have to manage it like an exceptionally capable but unreliable junior colleague. Without rules, outcomes depend entirely on individual skill—some people excel, others flounder, and nothing scales. 

Harness Engineering institutionalizes that management experience: defining when the AI works, what it does, when it must stop, what shape its output must take, how it corrects itself, and when a human must take over. It’s not about making AI smarter—it’s about formally defining how humans and AI divide labor.

From a management perspective, this is revolutionary. AI represents a new class of “worker”: fast, parallel, cheap, but with no sense of responsibility, boundaries, or accountability. The real question isn’t “Can AI do this?” but “Which part should AI own, and which part must remain human?” Harness Engineering answers that by assigning information retrieval, synthesis, and generation to the machine, while reserving goal-setting, risk judgment, and final decisions for humans, with a control layer enforcing format checks, retries, model switching, and handovers. 

In one sentence: Harness Engineering transforms human-AI collaboration from an individual craft into a scalable institutional system.

## What Follows the Harness? The Body and the Soul

Once the harness is in place, the next binding constraint becomes obvious. The real bottleneck isn’t the model’s intelligence—it’s the environment it inhabits and the memory it can carry. The next major frontier in agents will almost certainly be distributed runtime environments combined with distributed memory systems.

[A survey from CMU, Yale, and Amazon](https://picrew.github.io/LLM-Harness/) this year put it bluntly: “The harness is becoming the binding constraint.” Their seven-layer ETCLOVG taxonomy of open-source agent projects from 2022 to 2026 shows a stark asymmetry. The Execution Environment & Sandbox layer (E-layer) is the most mature, with over 20 major projects. The Context & Memory Management layer (C-layer) is the thinnest, with few standalone components—most are buried inside frameworks as an afterthought. The most mature layer and the weakest layer are two sides of the same coin.

Think about why. 

The execution environment answers where an agent runs. The memory system answers what it remembers. 

Today, you can give an agent a cloud computer to write code, browse the web, and manipulate files, but when the task ends, the machine is destroyed. Next session, it starts from scratch. Data from E2B confirms the trend: from 2024 to 2025, the average sandbox lifespan grew more than tenfold. Agents are moving from minutes-long tasks to hours-long, long-horizon workflows. Whether it’s Manus or domestic cloud-based agent instances, we are essentially simulating an entire human workflow inside a virtual computer. The sandbox has evolved from a temporary tool to a persistent workspace, but the memory layer hasn’t caught up. The information, heuristics, and corrected mistakes generated during a long session remain trapped in that disposable environment.

![](https://pbs.twimg.com/media/HMYcKU1a0AEBLM6.jpg)

This is why the next leap must fuse runtimes and memory. They are inseparable. Sandboxes provide isolation and elasticity but no continuity; memory provides continuity but needs an execution context to be written and consumed. 

A distributed runtime environment is naturally multi-instance: agents spin up different sandboxes at different times, and multiple agents run concurrently across them. This demands that memory must detach from any single instance and become an independent service accessible to all. The two form a closed loop: the runtime generates memories, memories guide future runtime behavior, and that behavior generates new memories.

![](https://pbs.twimg.com/media/HMYcYBbasAA4HF7.jpg)

But distributed memory is far harder than most imagine. It isn’t just dumping chat logs into a vector database. Real distributed memory must solve three layers of escalating difficulty:

1. Persistence: An agent works for two hours in Sandbox A. When it starts again in Sandbox B, it needs seamless access to its full working state—not just files, but explored paths, decisions made, and errors fixed. Projects like MemGPT (now Letta) pioneered self-managed memory hierarchies, similar to OS virtual memory, but they still focused on a single agent in a single environment.

2. Sharing: When multiple agents collaborate, they need mechanisms to synchronize memories. A research agent’s discovery must be available in real time to a coding agent, whose design decisions must be visible to a testing agent. This is state synchronization for unstructured reasoning chains, not just structured key-value pairs—you can’t use Raft for this.

3. Evolution: Memory cannot be a static dump of a thousand raw sessions. It must self-refine, distilling patterns, preferences, and heuristics over time. Without this capacity, memory bloats until it paralyzes the system.

The landscape is already shifting. [E2B](https://www.latent.space/p/e2b) has gone from a handful of users to serving roughly half of the Fortune 500, generating millions of sandboxes weekly. Browserbase hit a $300 million valuation in under two years. Tencent Cloud recently open-sourced CubeSandbox, with sub-60ms cold starts and ~5MB memory per sandbox, while natively compatible with E2B’s SDK—just swap an environment variable to route traffic to your own cluster. The runtime layer is commoditizing fast. Yet memory remains stuck in the era of “saving chat history to a local Markdown file.”

This gap is unsustainable. The same evolutionary pressure that turned cloud computing from ephemeral instances into dependable infrastructure will strike here. Early AWS gave you virtual machines, but it wasn’t until the introduction of EBS (Elastic Block Storage) that instances could keep a disk that survived termination—that’s when cloud computing truly took off. E2B and CubeSandbox are the early EC2 of the agent world. The EBS for agents—a universal, distributed, persistent memory layer—has yet to arrive.

![](https://pbs.twimg.com/media/HMYd5TYbsAAdvKH.jpg)

If the runtime environment is the agent’s body, memory is its soul. A body without a soul is an idle machine; a soul without a body is a wandering ghost. The combination of the two will transform agents from disposable task executors into long-lived digital workers that accumulate non-fungible, individual experience. When that closed loop of execution and memory finally clicks, we won’t just have better agents. We’ll have a new class of collaborator that grows with us.

---

_Originally published on [X](https://x.com/Simonsterrific/status/2073382538912071874)._
