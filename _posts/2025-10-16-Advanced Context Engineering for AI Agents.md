# Advanced Context Engineering for AI Agents  
## Practical Lessons from the Manis Agent in Production

The rapid evolution of artificial intelligence has brought about a fundamental shift in how developers think about building intelligent systems. What began as an emphasis on prompt engineering—carefully crafting inputs to elicit better model outputs—has evolved into a broader and more strategic discipline known as context engineering. This transition is inseparable from the rise of AI agents: systems that autonomously plan, call tools, and execute multi-step tasks over extended periods of time.

As agents operate, every tool invocation generates new information that is appended to the conversation history. Over the course of a long-running task—often requiring dozens of tool calls—this process can lead to unbounded context growth. Herein lies a central tension. On one hand, agents require rich and persistent context to function autonomously. On the other, both research and real-world experience show that model performance degrades as context length increases, a phenomenon often referred to as *context rot*.

Context engineering emerges as a response to this tension. It is both an art and a science: the deliberate practice of filling the context window with precisely the information the model needs *next*, no more and no less. Importantly, context engineering also draws a strategic boundary between the application layer and the model layer. As Manis co-founder Pete has emphasized, this separation allows teams to move quickly by leveraging general-purpose foundation models, without prematurely falling into the costly trap of model fine-tuning. This lesson was learned the hard way. In a previous startup, Pete’s team trained their own language model from scratch, only to find that product innovation became tightly constrained by the pace of model iteration. Context engineering offers a way out: by managing context intelligently, teams can dramatically improve agent performance, stability, and efficiency without modifying the underlying model.

This whitepaper distills advanced context engineering techniques derived from Manis’s production experience. These techniques revolve around three core themes: context reduction, context isolation, and context offloading.

---

## Mermaid: How Context Reduction Actually Runs (Thresholds → Compaction → Summarization)

Manis treats context reduction as a controlled workflow. It triggers early—*before* the hard context limit—at a “pre-degradation threshold” where quality often starts to slip. The system first tries reversible compaction (externalizing recoverable data), and only escalates to lossy summarization when compaction can no longer meaningfully shrink the context.

```mermaid
flowchart TD
  A[Agent runs: tool calls accumulate] --> B{Context length near<br/>pre-degradation threshold?}
  B -- No --> A
  B -- Yes --> C[Step 1: Reversible Compaction<br/>Externalize recoverable info<br/>(e.g., keep file path, drop file content)]
  C --> D{Freed enough space?}
  D -- Yes --> E[Continue task<br/>Keep most recent tool calls intact<br/>as few-shot examples]
  D -- No --> F[Step 2: Offload raw history<br/>to logs/files for backup]
  F --> G[Lossy Summarization<br/>Prefer schema-based summaries]
  G --> H[Resume task<br/>Preserve last N interactions verbatim<br/>to avoid behavior/voice shift]
```

---

The first pillar, context reduction, addresses the problem of ever-growing conversation histories. Naïve approaches such as truncation or indiscriminate summarization often result in catastrophic information loss, causing agents to “forget” critical details that may only become relevant many steps later. To avoid this, Manis employs two fundamentally different reduction strategies that strike a careful balance between efficiency and reversibility.

The first strategy is reversible compression. Rather than compressing information in the traditional sense, this approach externalizes data that can be reliably reconstructed from external state. Consider a common tool call that writes content to a file. Once the operation succeeds, the file content is safely stored on disk. At that point, the historical tool call no longer needs to include the full content payload. Retaining only the file path is sufficient, because a capable model can later retrieve the content by reading the file. This method is critical because it preserves the recoverability of information. In agent development, one never knows which past action may suddenly become crucial ten steps later. Reversible compression ensures that no information is truly lost—only relocated—allowing context length to shrink while maintaining full traceability.

The second strategy is irreversible summarization, which is applied far more conservatively. Summarization replaces long spans of dialogue with a condensed textual representation and is inherently lossy. In Manis, this technique is only used when reversible compression yields diminishing returns. Before any summarization occurs, the original context is offloaded to external logs or files, ensuring that raw data remains accessible. In fact, a sufficiently capable agent can later recover summarized details by searching these logs using standard shell tools such as `grep` or `glob`. This effectively places a safety net beneath an otherwise destructive operation.

To improve reliability, Manis favors structured summaries defined by schemas, transforming summarization from an open-ended generation task into a predictable form-filling exercise.

---

## Mermaid: Two Multi-Agent Collaboration Patterns + Schema as a Contract (Agentic MapReduce)

Multi-agent systems raise a core question: do we keep contexts isolated and exchange only results, or do we let agents share the full context when the process matters? Manis uses both patterns, then enforces reliable handoffs via schema-constrained outputs.

```mermaid
flowchart LR
  M[Main Agent] -->|Delegates task| S1[Sub-agent (isolated context)]
  S1 -->|Returns only final result| M

  M -->|Shares full history context| S2[Sub-agent (shared context<br/>own system prompt & tools)]
  S2 -->|Findings, notes, failures matter| M

  M --> C[Define Output Schema<br/>(contract)]
  C --> R[Sub-agents compute in parallel]
  R -->|submit_result with constraint decoding| A[Aggregator in Main Agent]
  A --> M
```

While reduction controls context size, context isolation addresses relevance and interference, particularly in multi-agent systems. Multi-agent collaboration introduces a new challenge: how should agents share information without overwhelming one another? A useful analogy comes from the Go programming community: “Do not communicate by sharing memory; instead, share memory by communicating.” Interpreting “memory” as “context,” this principle maps neatly onto two distinct agent collaboration patterns.

In the communication-first pattern, the main agent delegates a well-scoped task to a sub-agent, which operates within its own isolated context containing only the task description. The main agent is indifferent to how the task is executed and cares only about the final result. This pattern is ideal for bounded tasks such as searching a codebase or extracting specific data.

In the shared-context pattern, sub-agents have access to the full conversation history but operate under their own system prompts and tool permissions. This is analogous to threads sharing a common memory space. The benefit is clear in complex, exploratory tasks such as deep research, where intermediate discoveries and failed attempts are themselves valuable. The trade-off is cost: larger input contexts increase token consumption, and differing prompts and tool sets prevent reuse of KV caches, requiring full recomputation on each call.

To ensure reliable handoffs between agents, Manis treats schemas as contracts. Before delegating work, the main agent defines a strict output schema. Sub-agents must return results through a dedicated submission tool, and constraint decoding enforces compliance with the schema. This turns collaboration into an agentic MapReduce pattern: the main agent distributes tasks and defines formats, while sub-agents process work in parallel and return structured results for aggregation.

---

## Mermaid: Hierarchical Tooling (Stable Core → Sandbox CLI → Code/APIs) with a Unified Interface

As toolsets grow, agents risk context confusion—calling the wrong tool, misusing parameters, and invalidating caches when tool definitions change. Manis addresses this by keeping a small, stable core tool layer and pushing most expansion into offloaded environments.

```mermaid
flowchart TB
  subgraph L1[Layer 1: Stable Atomic Core (10–20 tools)]
    F[file: read/write]
    SH[shell]
    SE[search]
    BR[browser]
  end

  subgraph L2[Layer 2: Sandbox CLI Tooling]
    CLI[format converters / ASR / MCP CLI / etc.]
    OUT[large outputs → files]
  end

  subgraph L3[Layer 3: Code & APIs]
    PY[write Python scripts]
    API[authorized packages/APIs]
    SUM[return only summaries / conclusions]
  end

  SH --> CLI
  CLI --> OUT
  F --> PY
  PY --> SH
  PY --> API
  API --> SUM
  OUT --> F
  SUM --> F

  note1((Unified interface:<br/>model mostly uses L1 tools<br/>(shell + file) to reach L2/L3))
  L1 --- note1
```

Beyond dialogue and history, an agent’s context also includes its available tools. As toolsets grow, agents risk context confusion—calling the wrong tool, misusing parameters, or invalidating caches when tool definitions change. Manis addresses this through hierarchical action spaces and aggressive context offloading.

At the core lies a small, stable set of atomic tools—roughly ten to twenty functions for reading and writing files, executing shell commands, searching, and basic browser interactions. This layer is intentionally minimal and cache-friendly, as tool definitions remain fixed.

The second layer expands capability through a sandboxed Linux environment. Using shell commands from the core layer, agents can invoke preinstalled CLI tools. This approach scales without polluting the function-call surface area and is well-suited to large outputs by streaming results to files and processing them with standard Unix tooling.

The third layer enables complex computation through code execution, typically via Python scripts that call authorized APIs or libraries. This suits heavy computation tasks where intermediate data does not need to reside in the model’s context, allowing the model to keep the context lean and focused on decisions rather than raw data.

Despite this layered structure, all actions ultimately flow through the same small set of core tools. From the model’s perspective, the interface remains stable even as the underlying action space becomes nearly unbounded. This design reconciles two opposing goals: a minimal, cache-friendly interface and maximal extensibility.

---

Stepping back, the deeper lesson of context engineering lies not in any single technique but in the balance among competing forces. Manis’s experience repeatedly showed that the greatest gains came not from adding complexity, but from removing it. Trusting the model more and simplifying system design consistently yielded faster, more stable, and more intelligent behavior. The guiding philosophy became clear: build less and understand more. Context engineering should make the model’s job easier, not harder.

At the same time, practitioners must navigate complex trade-offs. Offloading and retrieval make reduction safer; reliable retrieval enables isolation; isolation reduces reduction frequency but increases cache inefficiency; and each adjustment affects latency, cost, and fidelity. Context engineering is ultimately an exercise in balance.

Finally, systems must be designed for evolutionary foundations. Manis evaluates architectural health by holding agent structure constant while swapping weaker and stronger models. If performance scales naturally with model capability, the architecture is future-proof. If not, it is likely compensating for model limitations with brittle scaffolding.

Excellence in context engineering lies in building simple yet powerful platforms that allow increasingly capable models to fully express their strengths. As foundation models continue to advance, disciplined context engineering will remain one of the most important levers for unlocking the next generation of AI agents.
