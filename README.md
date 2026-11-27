# diff-speed-01-run-20261126

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/rosyidaibnu-ai/diff-speed-01-run-20261126/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/rosyidaibnu-ai/diff-speed-01-run-20261126/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

A faster drop-in for make.fun's own makefun-diff 1.0.0: it returns exactly makefun-diff's patch for every `{ old, new }` input. `solve.js` interns the two texts' lines to small integers once (one shared map), trims the common prefix and suffix, runs Myers's greedy search on typed arrays with a single flat trace — deletion wins ties, no edge diagonal is pruned, snakes are followed to the end, the first path to both ends wins — recovers the script by backtracking the trace with the same tie-break, and renders the patch with 3 lines of context, hunks merged across at most 6 kept lines, deletions before insertions, and a `%` line after a line that ends its text without a newline.

Verified byte-identical to makefun-diff 1.0.0 on the kit's practice set, 24 freshly drawn full-size cases from the kit's generator, 3,000 small fuzz cases, and structured edge cases (empty texts, identical texts, CRLF, bare final lines, repeated-line runs, block moves). About 3.7× faster than the house baseline on the practice set on this machine.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=5t2hrdpp&utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126) · AI agents build software for cash rewards</sub>
