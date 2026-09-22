# Launch material

## GitHub description

Hinge — a Jev-powered decision workbench that prices mistakes, stress-tests uncertainty, and asks the clarification most likely to change the outcome. TypeScript engine + interactive studio + replayable receipts.

Suggested repository name: `hinge-jev`

Suggested topics: `jev`, `typesafe-ai`, `decision-theory`, `human-in-the-loop`, `typescript`, `explainable-ai`, `value-of-information`.

## LinkedIn draft

“Clean up the old records.”

An AI can confidently interpret that sentence—and still archive the wrong environment or propose deleting something that needed to stay recoverable.

I built Hinge to explore a different question: what is the smallest clarification worth asking before taking the next step?

Hinge connects TypeSafe's Jev to a decision engine that:
• models several possible interpretations;
• gives each mistake an explicit cost;
• stress-tests what happens when the probabilities are wrong;
• ranks clarifying questions by their modeled value;
• exports a receipt you can inspect and replay.

The interesting part: a likely interpretation and a good next action are different things.

The demo covers data cleanup, release rollbacks, and sharing requests. It runs locally with clearly labeled example distributions, and includes a server-side Jev adapter for early-access accounts. It proposes actions; it does not execute them.

Value-of-information clarification builds on existing research. My contribution is making the tradeoffs tangible and the decision process reproducible with Jev.

I'm looking for a real workflow where we can measure cost-weighted mistakes and unnecessary interruptions in shadow mode.

[Add your repository URL]

#AI #OpenSource #Jev #HumanInTheLoop #DeveloperTools

Before posting: replace the repository placeholder. If you have run the live evaluation, add the measured model version, sample size, and results. Otherwise leave the current wording; do not imply the example distributions came from Jev.

## 45-second demo

1. 0–8s: Show the ambiguous cleanup request and five possible interpretations. Keep “Example data” visible if using fixtures.
2. 8–18s: Point to the cost of a mistaken action and the proposed environment question.
3. 18–27s: Select “Staging only.” Production branches disappear; a retention question remains.
4. 27–33s: Select “Yes, keep an archive.” The proposal becomes “Archive staging.”
5. 33–40s: Reset, open Decision policy, and change Probability stress to show the risk sensitivity.
6. 40–45s: Open the inspector and export a decision receipt. Close on “Probability is not permission.”

## Credible next release

Publish held-out, consented shadow-mode results before promising fewer errors or less review work. Expand the labeled set beyond nine smoke cases; include negation, conflicting scope, out-of-domain requests, zero-mass contradictions, misleading text, and non-English inputs. Compare against fixed-threshold and always-review baselines. Report negative results too.
