---
title: "The Seat Was Never the Product"
date: 2026-10-13
source: https://x.com/Simonsterrific/status/2110022880864120890
source_id: "2110022880864120890"
tags: [X Article]
---

![Cover](assets/x-articles/2110022880864120890-cover.png)

Adobe just finished the strongest quarter in its history and the market priced it like a company in decline. Both reactions are correct.

In its third quarter of fiscal 2026, Adobe reported record revenue of $6.76 billion, up 13% year over year, with non-GAAP earnings per share up 15%. Monthly active users crossed one billion, up more than 20%. AI-first annual recurring revenue passed $650 million, growing more than 150%. Firefly's enterprise ARR rose 40% quarter over quarter.¹

Then look at the line that matters: net new ARR fell 36% to 37% year over year, and remaining performance obligations grew just 8%.² Management attributes the drop to an intentional shift toward freemium and deferred pricing. That is a real explanation, and it is not the whole story.

The same quarter, Adobe shipped a genuinely competent agent. And that is the part worth understanding.

## The counterexample that is not a counterexample

The obvious bear case for Adobe is that someone rebuilt Photoshop for free. That happened. PhotoCraft, a clean-room reimplementation of Photoshop in Rust, passed 45,000 GitHub stars within two weeks of its late-September 2026 creation.³ FilmCraft, DesignCraft and a handful of siblings cover Premiere Pro, InDesign and Acrobat. Independent testing at Tedium found them fast, small, and genuinely usable: a few tens of megabytes instead of hundreds, discrete GPU detected on launch, an image editable within minutes.⁴

![The Great Wave open in PhotoCraft with a live Curves layer and a full layer stack. Source: storytold/photocraft, per source 3.](https://pbs.twimg.com/media/HUXW4lYagAAt6gK.jpg)

The details hold up under inspection. Levels and Curves panels behave, Layer Styles dialogs open, text layers expose tracking and leading. FilmCraft has a working multi-track timeline with a Lumetri-style color panel reached through an Effects Control tab.

![Monet's Impression, Sunrise with a working Levels panel: histogram, input levels, output levels. Source: storytold/photocraft, per source 3.](https://pbs.twimg.com/media/HUXW_55aoAErv0F.jpg)

The tempting conclusion is that Adobe is being out-built by a hobbyist. That conclusion is wrong, and Tedium's own reporting says why. Adobe's real problems, as the piece frames them, are end-user responsiveness, high cost, and platform lock-out, not the absence of features. The suite was rebuilt because the licensing and the platform strategy were resented, not because Photoshop lacked a Curves tool.

Something else is going on, and the ArtCraft family states it in its own documentation.

## The software is being rebuilt for a different customer

PhotoCraft's repository ships two documents that most coverage skipped: a control protocol and a Model Context Protocol server. The desktop app listens on loopback, authenticates every connection with a 256-bit token, and accepts one JSON object per line. ui.inspect returns the entire UI state: active tool, panel layout, open dialogs, even which brush preset picker is open and where. engine.execute runs any engine or UI command by id. The MCP server exposes command_run, command_batch, doc_inspect and render_preview as tools.⁵

Read that list again. The agent does not click buttons. It reads the application's full state and issues structured commands through a documented channel.

![FilmCraft: source monitor, program monitor, timeline, and an effects control panel. Source: getartcraft.com, per source 3.](https://pbs.twimg.com/media/HUXXKZNaUAAApe2.jpg)

This is what "agent-ready" means, and it is a different design goal from "usable by a human." A per-seat license prices a person sitting in front of an interface. A control protocol prices work performed. The ArtCraft apps were built to be driven by a program, so their natural unit of value is the operation, not the operator.

Adobe reached the same conclusion from the opposite direction. In June 2026 it expanded its creative agent across Photoshop, Premiere, Illustrator, InDesign and Frame.io, shipping an AI assistant as a sidebar inside each app. The assistant orchestrates multi-step workflows from a plain-language description: it chains edits, assembles rough cuts, batch-processes background removal, generates fifty versioned files from a spreadsheet in Illustrator, and runs pre-publish color-mode checks.⁶

Adobe also pushed its tools onto ChatGPT, Claude, Copilot, Gemini and Slack.⁷ Forest Key, who runs Adobe's agent and Firefly business, argued that creative ideas rarely begin inside one application and that users should not have to switch tools to act on them.

So the two sides converge on the same architectural claim: the interface is no longer where the work happens.

## Why the seat stops being a price

Per-seat pricing rested on one honest assumption. Value scaled with headcount. More humans logging in meant more work flowing through the system, which justified more recurring revenue. Vendor growth and customer headcount pointed the same direction for twenty years, and nobody had to think about it.

An agent breaks that link in both directions at once. It consumes heavy platform value while occupying zero seats, and the humans it displaces are not replaced.

Here is the part the industry keeps phrasing as a demand problem when it is an incentive problem. When a support agent resolves most tickets autonomously, the customer needs fewer fulfiller seats, not more. The vendor's revenue falls precisely because the product worked.

![Illustration: the mechanism in the paragraph above.](https://pbs.twimg.com/media/HUXXbCTaQAIIKhf.png)

Gartner put a number on the exposure in July 2026: up to $234 billion in enterprise application spending at risk by 2030 as agents execute across systems and reduce direct human interaction with the interfaces those licenses were priced against. Its phrasing is precise. Agentic systems, Gartner wrote, "break the link between user growth and revenue growth for many enterprise software vendors."⁸

The market read the same document. On January 30, 2026, Anthropic added plugin support to its workplace assistant with eleven open-source plugins spanning sales, finance, legal and support. The S&P 500 software and services index slid nearly 13% over five consecutive sessions and sat 26% below its prior peak; Thomson Reuters and LegalZoom each fell more than 15% in a single day. JPMorgan's Mark Murphy called the extrapolation illogical. The label stuck anyway: SaaSpocalypse.⁹

## What vendors actually did

Nobody deleted the seat. They bolted a meter onto it.

![Illustration: published list prices as of 2026.](https://pbs.twimg.com/media/HUXXyRLbsAArtLY.png)

Slack kept Business+ at $15 per user per month and capped its AI at 15 messages per member per week, with Flex Credits beyond the cap. Fin, formerly Intercom, still sells an $85-per-seat helpdesk and charges $0.99 per outcome, and will sell the agent with no seats alongside a competitor's helpdesk. Zendesk prices automated resolutions at $1.50 on commitment or $2.00 pay as you go, beyond those bundled with each seat. Salesforce runs three models simultaneously: a $5-per-user Agentforce license metered through Flex Credits at $0.10 per action, a $125-per-user add-on with unmetered employee usage, and a $2-per-conversation option for customer-facing agents.⁹ ¹⁰

The pattern is a hedge, and it is a revealing one. The seat keeps revenue predictable; the meter captures work agents perform beyond what a human user would have. Customers pay twice, once for access and once for the work.

The forecasts point the same way. IDC's FutureScape 2026 predicts that by 2028 pure seat-based pricing will be obsolete, forcing 70% of vendors to refactor their value proposition. Deloitte's 2026 TMT Predictions project seat-based vendor revenue share falling from 21% to 15% within a year. A Cruxy survey of 300 SaaS CEOs in April 2026 found 97% planning to retire seat-based pricing within two years, while 94% simultaneously said seat pricing still aligns with their product's value today.⁹ ¹¹

That contradiction is the whole industry's position in one data point. Everyone knows the model is ending. Almost nobody wants to be first to break their own revenue base.

![Illustration: the two pricing contracts compared.](https://pbs.twimg.com/media/HUXX85raoAA5qHV.png)

Adobe is not exempt, and its own numbers show where the pressure lands. Revenue growth is still double digits because it is running on user and usage expansion, not on people paying more per seat. Total ending ARR grew 11.2% to $27.50 billion, while net new ARR fell by more than a third. AI-first ARR above $650 million is real and growing fast, but it is roughly 2.4% of total ARR, which means the AI line is not yet carrying the company.¹ ²

## The part that is genuinely hard

Two things hold this analysis honest.

The first is that ArtCraft's future is not settled. Only the individual apps carry Apache-2.0 licenses; the umbrella project describes itself as fair-source, which is not an OSI-approved open-source designation. Reporting has raised the security and provenance questions that come with vibe-coded software nobody is reading. Tedium's assessment is that the project resembles Napster: possibly not legal, but capable of changing everything anyway, and almost certainly a preview of what others will attempt.⁴

The second is that agent pricing is fragile in ways seat pricing never was. Classic SaaS carried near-zero marginal cost to serve one more user. Every agent action burns real compute, so each request has a live cost and each pricing model inherits a new failure mode. Outcome definitions become the negotiation: a resolution, a conversation and an action are not comparable units, so $0.99 and $0.10 cannot be placed on one axis. Fin counts a resolution when the customer confirms the issue is resolved or stops asking; Zendesk waits 72 hours of inactivity; Salesforce bills per action regardless of whether anything got resolved. Meanwhile a January 2026 survey of 218 IT leaders found 78% had faced unexpected charges tied to consumption or AI pricing in the previous year, and 61% had cut projects because of unplanned SaaS cost increases.¹²

Pricing a thing you do not control the unit of is not obviously better than pricing a seat. It is just differently broken.

## What is actually collapsing

The useful reframing is that Adobe is not the story. It is the clearest instrument for reading the story, because its numbers are public and its competitors share its structure.

What is collapsing is a specific bargain: build once, distribute widely, price access by headcount. That bargain assumed the human was the bottleneck and the interface was the product. Both assumptions are now optional. Agents do not need a well-designed panel, and they can be given a control protocol instead of a screenshot.

The professional software that survives the transition will not be the software with the best features. It will be the software that sits behind one of three filters.

![Illustration: the three conditions described above.](https://pbs.twimg.com/media/HUXYGCmb0AAnGKb.png)

Deterministic correctness, where output must be exactly right or legally defensible and probabilistic generation cannot substitute. A regulatory moat, where compliance, audit trails and liability rest with a licensed entity an agent cannot impersonate. And proprietary data network effects, where value comes from data only one vendor holds rather than from an interface an agent can learn to drive.

Everything outside those three filters is now competing with a price that is collapsing toward the cost of inference. Adobe can win this, and it is behaving like a company that intends to: shipping the agent, opening the interfaces, and eating the near-term ARR hit to build a usage base. But it will win as an infrastructure vendor with a meter, not as a suite vendor with a seat map. The record quarter and the sliding net new ARR are not contradictory signals. They are the first two data points of the same transition...

## Sources

[1] Adobe, "Adobe Reports Record Q3 Results" (Exhibit 99.1, Form 8-K) — Q3 FY2026 record revenue of $6.76B, +13% YoY; total ending ARR $27.50B; RPO $22.16B; 1B+ MAU; AI-first ARR above $650M. [https://www.sec.gov/Archives/edgar/data/796343/000079634326000147/adbeex991q326.htm](https://www.sec.gov/Archives/edgar/data/796343/000079634326000147/adbeex991q326.htm)

[2] GuruFocus, "Adobe Inc (ADBE) (Q3 2026) Earnings Call Highlights: Record Revenue, 1 Billion MAU, and AI-First ARR Surging Over 150%" — net new ARR declined 36–37% YoY, RPO growth slowed to 8%, Firefly ending ARR grew 40% QoQ. [https://www.gurufocus.com/news/9077333/adobe-inc-adbe-q3-2026-earnings-call-highlights-record-revenue-1-billion-mau-and-aifirst-arr-surging-over-150](https://www.gurufocus.com/news/9077333/adobe-inc-adbe-q3-2026-earnings-call-highlights-record-revenue-1-billion-mau-and-aifirst-arr-surging-over-150)

[3] GitHub, "storytold/photocraft" — clean-room Rust reimplementation of Photoshop, created 2026-09-30, 45,000+ stars, Apache-2.0; sibling apps FilmCraft, DesignCraft and others. [https://github.com/storytold/photocraft](https://github.com/storytold/photocraft) | [https://github.com/storytold/artcraft](https://github.com/storytold/artcraft) | [https://getartcraft.com/apps](https://getartcraft.com/apps)

[4] Tedium, "Let's Deconstruct Photoshop" (Ernie Smith, Oct 8, 2026) — hands-on testing of the ArtCraft apps: tens of megabytes, GPU detected on launch, usable within minutes; frames Adobe's real failure as responsiveness, cost and platform lock-out. [https://tedium.co/2026/10/08/artcraft-vibe-coding-creative-cloud-remake/](https://tedium.co/2026/10/08/artcraft-vibe-coding-creative-cloud-remake/)

[5] PhotoCraft documentation, "Control protocol" and "MCP conventions" — loopback control server, 256-bit token auth, JSON-line protocol, ui.inspect and engine.execute; MCP tools command_run, command_batch, doc_inspect, render_preview. [https://github.com/storytold/photocraft/blob/main/docs/control-protocol.md](https://github.com/storytold/photocraft/blob/main/docs/control-protocol.md) | [https://github.com/storytold/photocraft/blob/main/docs/mcp.md](https://github.com/storytold/photocraft/blob/main/docs/mcp.md)

[6] Adobe, "Adobe Unveils Major Expansion of Creative Agent Across Firefly and Creative Cloud Apps Including Photoshop and Premiere" (June 18, 2026) — creative agent rolled out across Photoshop, Premiere, Illustrator, InDesign and Frame.io; assistant appears as an in-app sidebar and orchestrates multi-step workflows. [https://news.adobe.com/news/2026/06/adobe-unveils-major-expansion-creative-agent](https://news.adobe.com/news/2026/06/adobe-unveils-major-expansion-creative-agent)

[7] Adobe HelpX, "Firefly AI Assistant overview" — conversational creative agent that interprets a request, breaks it into steps and executes multi-step workflows across Creative Cloud apps. [https://helpx.adobe.com/firefly/web/firefly-ai-assistant/firefly-ai-assistant-overview.html](https://helpx.adobe.com/firefly/web/firefly-ai-assistant/firefly-ai-assistant-overview.html)

[8] Gartner, via Datafloq, "SaaSpocalypse Reality Check: Vendors Keep the Seat and Add a Meter" (Oct 6, 2026) — Gartner's July 1, 2026 estimate that up to $234B of enterprise application spending is exposed to agentic arbitrage by 2030, and its statement that agents "break the link between user growth and revenue growth." [https://datafloq.com/saaspocalypse-reality-check-vendors-keep-the-seat-and-add-a-meter](https://datafloq.com/saaspocalypse-reality-check-vendors-keep-the-seat-and-add-a-meter)

[9] Datafloq, "SaaSpocalypse Reality Check: Vendors Keep the Seat and Add a Meter" (Oct 6, 2026) — the January 30, 2026 Anthropic Cowork plugin launch and the resulting selloff: software and services index down nearly 13% over five sessions, 26% below peak; Thomson Reuters and LegalZoom each down more than 15%; Slack, Fin, Zendesk and Salesforce list prices and meters. [https://datafloq.com/saaspocalypse-reality-check-vendors-keep-the-seat-and-add-a-meter](https://datafloq.com/saaspocalypse-reality-check-vendors-keep-the-seat-and-add-a-meter)

[10] Intercom, "Intercom Pricing: Plans, Features, and What You'll Actually Pay" — $0.99 per outcome, seat-independent deployment alongside another helpdesk, $1M resolution-rate guarantee, published competitor rate comparison. [https://www.intercom.com/learning-center/intercom-pricing](https://www.intercom.com/learning-center/intercom-pricing)

[11] AI2Work, "Seat-Based Licensing Is Collapsing to 7% as AI Agents Take Over" — IDC FutureScape prediction that pure seat-based pricing becomes obsolete by 2028 with 70% of vendors refactoring; Deloitte TMT 2026 projection of seat-based revenue share falling from 21% to 15%; Cruxy survey of 300 SaaS CEOs (April 2026): 97% plan to retire seat-based pricing in two years while 94% say it still fits their product. [https://ai2.work/blog/seat-based-licensing-is-collapsing-to-7-as-ai-agents-take-over](https://ai2.work/blog/seat-based-licensing-is-collapsing-to-7-as-ai-agents-take-over)

[12] Datafloq, "SaaSpocalypse Reality Check: Vendors Keep the Seat and Add a Meter" (Oct 6, 2026) — Zylo's January 2026 survey of 218 IT leaders: 78% hit unexpected consumption or AI charges in the prior 12 months, 61% cut projects after unplanned SaaS cost increases; 72-hour inactivity rule for Zendesk resolutions and the differing outcome definitions across vendors. [https://datafloq.com/saaspocalypse-reality-check-vendors-keep-the-seat-and-add-a-meter](https://datafloq.com/saaspocalypse-reality-check-vendors-keep-the-seat-and-add-a-meter)

---

_Originally published on [X](https://x.com/Simonsterrific/status/2110022880864120890)._
