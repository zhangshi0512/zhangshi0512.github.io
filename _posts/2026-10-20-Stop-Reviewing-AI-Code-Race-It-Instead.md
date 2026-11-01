---
title: "Stop Reviewing AI Code. Race It Instead."
date: 2026-10-20
source: https://x.com/Simonsterrific/status/2112549815561421284
source_id: "2112549815561421284"
tags: [X Article]
---

![Cover](assets/x-articles/2112549815561421284-cover.png)

Last month our team's internal tech talk landed on one conclusion: abandon human code review.

Accept that any code an LLM produces will carry bugs. The most a person can do is let several agents cross-review and cross-repair. Put more bluntly: if your agent repairs fast enough, the bug is, for practical purposes, gone.

That takes three things. A frontier model. An environment that mirrors production. A system that automatically iterates on every problem it finds. Call the last one a harness.

Humans aren't bug-free. Neither is a model that distilled its patterns from human knowledge. The more complex a company's architecture, the more bugs live inside its services. A company that's still alive is a company that has bugs every single day.

So judging a model's output by how well it writes unit tests is self-deception. The review method that fits fast releases is a simulated run: watch whether the software behaves the way the design said it should. That splits into two paths. Either the project runs on a minimal stack, where a solo developer's Vercel plus Supabase is the same thing for dev, test, and production. Or you spend real effort building a digital twin of production.

This isn't intuition. DORA's 2025 survey of nearly 5,000 technologists found 90% of them using AI at work, and 30% still reporting little or no trust in the code it generates.¹ The report's framing is exact: AI is an amplifier. It magnifies a team's strengths and its dysfunctions alike.

![Figure 1: DORA 2025's AI Capabilities Model, in which AI adoption multiplies a team's surrounding capabilities to shape outcomes. Source: cloud.google.com | Sources [1]](https://pbs.twimg.com/media/HVFF83zb0AARcJe.jpg)

GitClear went further. Across more than 200 million changed lines, code churned within two weeks, meaning code rewritten or reverted almost as soon as it landed, climbed from 3.3% in 2020 to 7.1% in 2024.² Output doubled. Rework doubled with it.

You don't need the data to feel it. Your team's daily code volume went up two or three times; your reviewers' reading speed didn't, and there are still exactly as many of them. Arithmetically, line-by-line review stopped being a question of whether and became a question of can't.

A review you can't finish is the same as no review.

For a small team, the problem doesn't exist. The whole system runs on one machine, one front-end deploy, one database instance. You push, it's live, you roll back a single commit. "Environment parity" is a phantom, because there is no second environment.

The moment you enter a large company, it flips. One feature touches a dozen services, and above and below them sit message queues, caches, gateways, a canary layer. You will not stand up that entire chain just to validate a block of AI-written code. So a production mirror stops being optional and becomes the answer.

That mirror is not a staging cluster that "looks like" production. Everyone builds one of those, and most become a zombie fleet nobody touches within a month.

What works is shadow traffic: deploy the new version, let it consume the same live requests as the old one, but never persist its output or show it to a user. Then compare, request by request, against the old path.

Uber did exactly this when it rebuilt its payment account system. It copied live traffic into the new system, multiplied the shadow stream tenfold to stress it, and compared the two chains transaction by transaction, pulling out only the mismatches.³ GitHub had already been doing it for years with Scientist: both the old and the new code run on every request, users only ever receive the old result, and every discrepancy is logged.⁴

![Figure 2: GitHub Scientist's parallel-run model. Old and new code consume the same input, users get the old result, and every difference is recorded. Source: github.blog | Sources [4]](https://pbs.twimg.com/media/HVFGJ-wbEAAn9MQ.jpg)

In that frame, "does this code have a bug" is the wrong question. The right one is: given the same input, does the new code behave differently from the old?

Moving the object of verification from the code to the behavior is the dividing line for the entire method.

The old default was the unit test. You feed a function a few inputs and assert on a few outputs. But an AI writing tests and an AI writing code are two brothers from one split personality. It infers the assertions backward from the implementation it just wrote, and coverage sails past ninety percent. Such a test never checks whether the implementation is right. It only checks whether the implementation agrees with itself.

![Illustration: reading the diff versus verifying the behavior, and why only the second scales.](https://pbs.twimg.com/media/HVFGWWlbsAERMoV.png)

So you meet the strangest failure mode of all: green tests, ninety-something coverage, broken in production on day one.

Judging a model's output by its test pass rate is over. What you watch is whether, dropped into that simulation, the system's behavior matches the expectation you drew in the requirements doc.

Which is why the frontier model matters. On SWE-bench Verified's official leaderboard, the top score under the standard harness sits at 76.8%; vendors' self-reported, tool-assisted numbers clear 90%.⁵ The capability that separates them is the one that decides this whole game: can the agent run itself and actually resolve the problem?

![Illustration: the three data points behind the shift, DORA's adoption and trust gap, GitClear's churn curve, and SWE-bench's resolution ceiling. Numbers are sourced in the text.](https://pbs.twimg.com/media/HVFGlm6bAAAdfIP.png)

The repair-speed argument has an unstated premise: the net benefit of each repair has to be positive.

Uncle Bob hit this early. He let an agent add features to a project session after session, watched the mess compound, watched it change one thing and inadvertently break another, circle back to the start, and finally give up.⁶ That is not speed. It's a faster crash. A repair that introduces two new bugs isn't fast; it's acceleration downhill.

The more complex the system, the more easily that net benefit gets eaten. Lehman spelled it out decades ago: a system's complexity only rises, unless you actively invest in restructuring.⁷ Put plainly, a more complex architecture holds more bugs, so many that "as long as it's alive, there's no day without bugs." Google's SRE culture has a name for accepting this: a culture of inevitability. No system is perfect, and every system eventually fails.⁸

Concede that, and most of the argument dissolves. You don't need a bug-free system. You need a system whose bugs get fixed faster than they get written.

You don't get there by stacking models. You get there by ringing the model with constraints. The model generates and repairs; the environment falsifies; the loop closes.

![Illustration: the repair loop, from a frontier model through a production mirror and a behavior diff back into automatic repair.](https://pbs.twimg.com/media/HVFHDELaQAA0u1Z.png)

Anthropic's own agent loop is built on exactly this: gather context, take action, verify results, and when verification fails, feed the result back and run again.⁹ Its harness for long-running work splits an initializer agent from a coding agent and pairs a generator with an independent evaluator that scores the work and sends it back when the score is too low, two agents falsifying each other.

Whether that loop turns also depends on whether you have an eye that can see production. Logs, traces, and metrics in place mean an anomaly announces its own location. Without them, even a strong agent is editing blind. Teams that actually made repair fast usually filled in observability before they bought a more expensive model.

![Figure 3: Anthropic's minimum agent loop, gather context, take action, verify results, then feed the outcome back and run again. Source: claude.com | Sources [9]](https://pbs.twimg.com/media/HVFHNGuaoAAnJmj.jpg)

Uncle Bob later announced he doesn't read a single line of his agents' code. He added the precondition: he cages them with unit tests, mutation testing, coverage, and the CRAP score.⁶ Even he needed the constraints to buy confidence. A team that tries to skip that layer is running without a net.

Grady Booch pushed back, and his objection is the one worth keeping: coverage and complexity metrics tell you about functionality, not about the vulnerability an agent quietly introduced or the factorization it silently skipped.¹⁰

Both are right. The constraints don't replace judgment. They move where it gets spent: out of reading every line, and into designing the cage that every line has to escape.

All of this is a necessity for complex systems and a burden for simple ones. 

If your project runs on Vercel and Supabase, congratulations, you don't even need the first layer of the harness. 

For most teams dragging along a decade of history, the real cost was never the token bill. It's whether you can copy production into a shadow that dares to take live traffic...

## Sources

[1] Google Cloud, "Announcing the 2025 DORA Report: State of AI-Assisted Software Development" — survey of nearly 5,000 technologists; 90% use AI at work, 30% report little or no trust in AI-generated code, and the report frames AI as an amplifier. [https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report) | [https://dora.dev/research/2025/dora-report/](https://dora.dev/research/2025/dora-report/)

[2] DevClass, "AI assistance is leading to lower code quality, claim researchers" — reports GitClear's analysis of 150M+ changed lines, with code churn rising to 7.1% in 2024 from 3.3% in 2020. [https://devclass.com/2024/01/24/ai-assistance-is-leading-to-lower-code-quality-claim-researchers](https://devclass.com/2024/01/24/ai-assistance-is-leading-to-lower-code-quality-claim-researchers)

[3] Uber Engineering, "Building High Throughput Payment Account Processing" — validates a rebuilt system by shadowing live traffic, amplifying the shadow stream (10x, 15x) and diffing the two runs transaction by transaction. [https://www.uber.com/in/en/blog/high-throughput-processing/](https://www.uber.com/in/en/blog/high-throughput-processing/)

[4] GitHub, "Scientist" — a library that runs old and new code paths in parallel, returns only the old result, and records every discrepancy. [https://github.com/github/scientist](https://github.com/github/scientist)

[5] SWE-bench, "Official Leaderboards (Verified)" — under the standard mini-SWE-agent harness, the top score is 76.8% (Claude Opus 4.5, high reasoning). [https://www.swebench.com/](https://www.swebench.com/)

[6] Robert C. Martin (Uncle Bob), the July 2026 X post and the coverage around it — he states he no longer reads any code his agents write and instead surrounds them with "extreme constraints" (unit tests, Gherkin tests, mutation testing, coverage). [https://www.plainconcepts.com/we-dont-review-code-anymore](https://www.plainconcepts.com/we-dont-review-code-anymore) | [https://reasoncore.dev/post/robert-c-uncle-bob-martin-says-he-no-longer-reads-ai-generated-code](https://reasoncore.dev/post/robert-c-uncle-bob-martin-says-he-no-longer-reads-ai-generated-code)

[7] Lehman's laws of software evolution — complexity only increases unless work is invested in restructuring (Second Law); quality declines without deliberate maintenance (Seventh Law). [https://www.cs.kent.edu/~jmaletic/cs63902/Papers/Godfrey08.pdf](https://www.cs.kent.edu/~jmaletic/cs63902/Papers/Godfrey08.pdf)

[8] Google SRE, "Building Secure and Reliable Systems," Chapter 21 — "A Culture of Inevitability": no system is perfect and any system may eventually fail. [https://google.github.io/building-secure-and-reliable-systems/raw/ch21.html](https://google.github.io/building-secure-and-reliable-systems/raw/ch21.html)

[9] Anthropic engineering, "Effective harnesses for long-running agents" and "Harness design for long-running application development," plus the Claude verification-loop writeup — the gather-act-verify loop, initializer/coding agent split, and generator/evaluator pairing. [https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | [https://www.anthropic.com/engineering/harness-design-long-running-apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | [https://claude.com/blog/building-verification-loops-in-claude-code-with-skills](https://claude.com/blog/building-verification-loops-in-claude-code-with-skills)

[10] Startup Fortune, "Uncle Bob Martin says he no longer reads AI-generated code and the developer world is split" — Grady Booch's rebuttal that coverage and complexity metrics say nothing about vulnerabilities, dead code, or missed factorization. [https://startupfortune.com/uncle-bob-martin-says-he-no-longer-reads-ai-generated-code-and-the-developer-world-is-split/](https://startupfortune.com/uncle-bob-martin-says-he-no-longer-reads-ai-generated-code-and-the-developer-world-is-split/)

---

_Originally published on [X](https://x.com/Simonsterrific/status/2112549815561421284)._
