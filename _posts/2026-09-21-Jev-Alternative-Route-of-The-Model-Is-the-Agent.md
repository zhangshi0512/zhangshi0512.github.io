---
title: "Jev —— Alternative Route of \"The Model Is the Agent.\""
date: 2026-09-21
source: https://x.com/Simonsterrific/status/2102065903517253824
source_id: "2102065903517253824"
tags: [X Article]
---

![Cover](assets/x-articles/2102065903517253824-cover.jpg)

Jev is not the next agent route. It is the quiet end of the assumption that the agent is the model.

On September 15, 2026, Diogo Almeida ended two years of stealth and released Jev through TypeSafe AI, alongside a $40 million seed round led by DCVC¹. Almeida co-authored the InstructGPT paper and is one of the people who built RLHF, the method that taught language models to talk to people. 

The model he shipped this time refuses to talk. It generates no text, writes no code, holds no conversation. You hand it a block of state and a set of questions whose answer space you defined in advance, and it returns typed answers with probabilities³. Three primitives only: Choice picks one option from up to 255, Score places the input on an ordered scale, and Noul returns the probability that a yes/no claim is true³. 

TypeSafe calls the category "System One," borrowing Kahneman's fast and intuitive mode. The name comes from Jevons paradox².

![The entire interface: pick one, place on a scale, answer yes or no. No generated string ever leaves the model. Source: langchain.com | Sources [9]](https://pbs.twimg.com/media/HSwHPRnbkAErd-Y.jpg)

A man who taught AI to speak built a model that won't. That contrast is the best marketing in the launch and the biggest smoke screen in the coverage.

The headline numbers are severe. Seventy to five hundred milliseconds end to end, against 3 to 329 seconds for frontier models⁴. Input at $0.042 per million tokens, output free, because there is no output token³. The homepage banner claims 193.6x faster and 444.6x cheaper, and TypeSafe itself labels those figures as the high end of real-world gains⁴.

![Jev sits at the far cheap end with mid-tier accuracy. Nothing else on the chart is both cheaper and more accurate, which is the actual claim. Source: typesafe.ai | Sources [4]](https://pbs.twimg.com/media/HSwHvIZaUAAcVpg.png)

On TypeSafe's own four-workflow evaluation, Jev averages 67.8% agreement at $0.0004 and 0.4 seconds per case. GPT-5.6 Sol reaches 74.1% at $0.0836 and 23.3 seconds. Claude Opus 5 reaches 73.1% at $0.1761 and 37.8 seconds⁵. 

Jev is not the most accurate model on its own chart; it is the only point nothing dominates on both axes at once. Broken out, the spread widens: 76.0% on customer service, but 61.8% on invoice processing against Sol's 79.1%, a seventeen-point gap⁶. And the famous "0% hallucination" has to be read exactly. TypeSafe's own wording: "our number is not empirical. Schema matching is guaranteed"⁶. The type can never be wrong. The judgment still can.

![The 0% column is a structural guarantee, not a measurement. On the same chart, Haiku 4.5 breaks structured output 45.5% of the time and Sol fails tool calls 17.0% of the time. Format is a real wound in this industry, and it is a different wound from being wrong. Source: typesafe.ai | Sources [6]](https://pbs.twimg.com/media/HSwH8-jbcAA1sUU.png)

Type-correct is not judgment-correct.

The most convincing evidence for Jev arrived five days later, from outside TypeSafe, and from a use case nobody was watching. On September 20, LangChain published a controlled test of Jev as a judge over agent traces: five frozen weather-agent runs from LangChain's own open-source harness, each graded 100 times against a human-labeled oracle. 

Jev matched the human on all 500 binary pass/fail decisions. GPT-5.6 Terra hit 99.8%, Luna 96.4%, Claude Sonnet 4.6 80.0%. Jev's per-case quality-score variance was 0.0000149, between 92x and 913x lower than the three language-model judges. It cost $0.00035 per call and $0.34 in total, against $28.17 for Claude⁹.

![The evaluator path most teams actually shipped: an autoregressive model writes a rationale, then code parses that text back into a score. Jev returns the score directly. Source: langchain.com | Sources [9]](https://pbs.twimg.com/media/HSwIHr9bYAA5DFf.jpg)

Notice what LangChain did not do. They did not let Jev run the agent. They let Jev grade the agent.

That is the part worth keeping.

A product like Jev needs to exist because the last three years of agent engineering made one architectural mistake and then spent enormous effort patching it: we put control flow inside an autoregressive sampling loop. An agent run contains dozens of tiny decisions. Did this step succeed. Call tool A or tool B. Stop or continue. Those are control-flow questions, and we answered them by sampling tokens and parsing the result.

![](https://pbs.twimg.com/media/HSwIZixaMAAxVuX.png)

So a whole layer grew up around the mistake: JSON schema constraints, function-call retries, routers, guardrails, judge calls, and pages of prompt text begging the model to stay in format. That layer is string patching a type system.

Jev's actual move is small and structural. Give the judgment a type, and put the control flow back in the code. Almeida says it flatly in the launch thread: "We believe that the future is code + AI"². That sentence is the thesis. It is not a claim that the model becomes the agent. It is a claim that the model becomes a function the program calls.

Jev is not making agents more agentic. It is demoting the agent from a model to a function.

Which is why "will this be the new agent route" is the wrong question. Model-as-agent and program-as-agent were never parallel tracks, and Jev shoves the whole stack onto the second one. The name is a bet in the same direction. Jevons paradox does not say cheap things get used less; it says cheap things get used far more, in places nobody bothered to use them. Judgment cheap enough to be free will not produce more agents. It dissolves the word "agent" into infrastructure. After SQL, nobody said they wanted to buy a database query robot.

![](https://pbs.twimg.com/media/HSwIyU7a8AA1PeE.png)

The ceiling is as clear as the pitch. Calibration is a population-level property: a 0.83 confidence describes the batch, not this call¹⁰. Compose a dozen Jev calls into one workflow and nothing guarantees the calibration survives your thresholds. The architecture is undisclosed, which ends the conversation in finance, insurance and medicine, where a decision has to be defensible in writing¹⁰. Every's independent test found Jev 25x faster and 580x cheaper than a frontier model, and also found that one of seven planted defects went undetected across three retries⁷. 

A non-peer-reviewed run of 6,560 requests saw a single failure, but semantically identical renamings and reorderings still changed the answers¹¹. Single-shot Jev scored 62.6% on a phishing-link check; splitting the question into five narrow signals and combining them in ordinary code took it to 95.1%, which is the signature of a feature extractor, not a decision maker⁸. And LangChain, the source of the most flattering test so far, supplies the counterweight itself: low cost can amplify mistakes, and a consistently wrong evaluator generates bad feedback at scale⁹. Every published result lands in the same place. Useful as a sentinel. Unsafe as a verdict.

So the likely end state is not a smarter agent, it is a tiered system. A scheduler decides which judgment goes where. A frontier model does the slow thinking. A Jev-class model fires millisecond calls. Deterministic code executes. The scheduler is where the word "agent" actually belongs, and it is the least glamorous part of the stack.

Jev did not open a new agent route. It handed the word "agent" back its coordinates.

Whether it grows into the thing it promises, whether the price holds, when the architecture is published, who is accountable when a 0.91 turns out wrong… all of that is still open. 

One thing is already settled. The moment judgment became cheap enough to insert anywhere, the thing we had been calling an agent turned out to be a handful of decision primitives with a control flow around them. 

## Sources

[1] The man who taught ChatGPT to talk built a mute model: Diogo Almeida is the ex-OpenAI researcher and InstructGPT co-author behind TypeSafe AI; Jev shipped September 15, 2026 with a $40M seed led by DCVC. https://eu.36kr.com/zh/p/3988372551990276 

[2] @CompleteSkeptic (Diogo Almeida), "After co-inventing ChatGPT, I kept asking myself…": the founder's launch thread, including 20-200x faster, 40-400x cheaper, output tokens free, $42 per billion input tokens, the Jevons paradox naming, and "we believe that the future is code + AI." [https://x.com/CompleteSkeptic/status/2099925682726002904](https://x.com/CompleteSkeptic/status/2099925682726002904)

[3] the three primitives Choice, Score and Noul, Choice capped at 255 options, $0.042 per million input tokens with output free. [https://news.qq.com/rain/a/20260917A0AMRY00](https://news.qq.com/rain/a/20260917A0AMRY00)

[4] AI Wiki, "TypeSafe AI": official claims of 70-500ms end to end against 3-329 seconds for frontier models, 20-200x faster and 40-400x cheaper, the 193.6x/444.6x homepage headline, TypeSafe's own caveat that it is the high end of real-world gains, and the four-workflow evaluation setup. [https://aiwiki.ai/wiki/typesafe_ai](https://aiwiki.ai/wiki/typesafe_ai)

[5] Logic Decode, "TypeSafe's Jev: An AI Model That Answers in Types, Not Text": per-model figures from TypeSafe's own four-workflow eval, Jev 67.8% / $0.0004 / 0.4s, GPT-5.6 Sol 74.1% / $0.0836 / 23.3s, Claude Opus 5 73.1% / $0.1761 / 37.8s. https://logicdecode.in/blog/typesafe-jev-system-one-model-2026 

[6] GEO Toolbox, "What Is Jev? TypeSafe AI's New Non-Chat Model, Explained": TypeSafe's own qualifier "our number is not empirical. Schema matching is guaranteed," the 61.8% invoice-processing score against Sol's 79.1%, 76.0% on customer service, and the 45.5% structured-output error rate for Haiku 4.5. https://geotoolbox.ai/blog/what-is-jev-ai 

[7] OrcaRouter, "Jev: TypeSafe's Decision Model, Speed and Cost Explained": 21 questions across 37 documents landing inside the same 0.7 seconds, and Every's 12-sample synthetic-defect test where Jev ran 0.35s against Claude Fable 5.1's 8.83s while missing one of seven planted defects across three retries. https://www.orcarouter.ai/blog/jev-typesafe-system-one-what-we-know 

[8] DEV Community (Aman Kumar), "Testing Jev on public and private data: classifier or filter?": single-shot Jev at 62.6% on a phishing-link check, rising to 95.1% once the question is split into narrow signals and combined in code; the author's verdict that Jev is a filter, not a classifier. https://dev.to/onlyoneaman/testing-jev-on-public-and-private-data-classifier-or-filter-31pc 

[9] LangChain, "Jev-as-a-Judge for Agent Evals": third-party test on LangChain's own Deep Agents harness, five frozen weather-agent runs graded 100 times each against a human-labeled oracle; Jev matched on 500/500 binary decisions versus 99.8% for GPT-5.6 Terra, 96.4% for GPT-5.6 Luna and 80.0% for Claude Sonnet 4.6; per-case variance 0.0000149 (92x to 913x lower); $0.00035 per call and $0.34 total against $28.17 for Claude; LangChain's own caveats that the result is early and narrow, that it is observational rather than causal, and that low cost can amplify mistakes. [https://www.langchain.com/blog/jev-agent-evals-langsmith](https://www.langchain.com/blog/jev-agent-evals-langsmith)

[10] Kingy AI, "TypeSafe Jev Review: The AI Model That Doesn't Generate Text": calibration is a population-level property that says nothing about any single call, no independent calibration reporting exists, and the undisclosed architecture blocks audit. [https://kingy.ai/blog/typesafe-jev-review-the-ai-model-that-doesnt-generate-text](https://kingy.ai/blog/typesafe-jev-review-the-ai-model-that-doesnt-generate-text)

[11] AI Primer, "Developers test Jev as a low-cost judge for agent evaluations": OpenProse's non-peer-reviewed test of Jev 1.13.0 on 496 synthetic samples with one failure in 6,560 requests, alongside evidence that semantically invariant renaming and reordering changed answers, and a Southbridge replay where harmful commands bypassed the classifier. [https://www.ai-primer.com/engineer/stories/jev-low-cost-evals-verifiers](https://www.ai-primer.com/engineer/stories/jev-low-cost-evals-verifiers)

---

_Originally published on [X](https://x.com/Simonsterrific/status/2102065903517253824)._
