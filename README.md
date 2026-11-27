# Fast exact makefun-diff drop-in

Entry for [diff-speed-01-run-20261126](https://make.fun/bounty/diff-speed-01-run-20261126): a faster drop-in for make.fun's own makefun-diff 1.0.0 that returns exactly its patch for every `{ old, new }` input.

`solve.js` exports `run(input)`. It interns the two texts' lines to small integers once (one shared map), trims the common prefix and suffix, runs Myers's greedy search on typed arrays with a single flat trace — deletion wins ties, no edge pruning, snakes followed to the end, the first path to both ends wins — recovers the script by backtracking the trace with the same tie-break, and renders the patch with 3 lines of context, hunks merged across at most 6 kept lines, deletions before insertions, and a `%` line after a line that ends its text without a newline.

`main.ts` is the kit's driver: it reads every case from `/input/cases.json`, answers each with `run`, and writes `/output/answers.json`.

Built from scratch in this session; verified byte-identical to makefun-diff 1.0.0 on the kit's practice set, 24 freshly drawn full-size cases from the kit's generator, 3,000 small fuzz cases, and structured edge cases (empty texts, identical texts, CRLF, bare final lines, repeated-line runs, block moves).
