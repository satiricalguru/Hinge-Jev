# Verification record

Verified locally on September 22, 2026, using Node.js 22.23.1 and headless Chrome.

| Check                                                        | Result                                     |
| ------------------------------------------------------------ | ------------------------------------------ |
| TypeScript and Vite production build                         | Pass                                       |
| Engine and provider tests                                    | 13 passed                                  |
| Exact stress optimizer vs exhaustive grid                    | Pass                                       |
| Desktop browser flow                                         | Pass, 1440px                               |
| Mobile flow and horizontal overflow                          | Pass, 390px and 320px                      |
| Production server browser flow                               | Pass                                       |
| Receipt downloaded through UI and replayed                   | Pass                                       |
| Malformed body, unsupported media type, cross-origin request | Rejected                                   |
| Dependency install audit                                     | 0 reported vulnerabilities at install time |
| Actual Jev inference                                         | **Not run: API key unavailable**           |

The live evaluation command was checked without a key. It exited with an explicit missing-key error and did not produce synthetic model results. Provider contract tests use an injected mock response; they do not validate actual model behavior.

## Analytical fixture comparison

These numbers are computed from authored distributions, not observed outcomes. The simulation assumes truth follows each fixture distribution and people answer every question truthfully. Interruption cost is 1 loss point per question; human review costs 20. The loss matrix and probabilities are deliberately illustrative.

| Scenario         | Argmax action expected cost | Minimum expected cost without questions | Hinge cost including questions and review | Expected questions |
| ---------------- | --------------------------: | --------------------------------------: | ----------------------------------------: | -----------------: |
| Atlas cleanup    |                       11.00 |                                   11.00 |                                      2.76 |               1.96 |
| Release rollback |                       10.62 |                                   10.62 |                                      2.57 |               1.97 |
| Sharing boundary |                        3.75 |                                    3.75 |                                      2.27 |               1.19 |

Reproduce with `npm run evaluate`. These are examples of the mechanism, not evidence of superiority over other systems or measured real-world impact. Losses, priors, review costs, and user-answer assumptions determine the outcome.

## Reproduce

```sh
npm ci
npm run build
npm test
npm run evaluate
npm run dev
```

With the server running in another terminal:

```sh
python3 scripts/browser_smoke.py
npm run evaluate -- --replay /tmp/hinge-browser-receipt.json
```

Install Python Playwright and its Chromium runtime if no supported browser is present. The script automatically uses installed Chrome on macOS.

After adding a TypeSafe key, run `npm run evaluate:live`. Report its actual returned model version and results separately from this fixture record.
