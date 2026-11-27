// Fast exact drop-in for makefun-diff 1.0.0 (diff-speed-01-run-20261126).
//
// Produces byte-identical output to make.fun's makefun-diff 1.0.0 for every
// { old, new } input, by the rule stated in the kit's RULES.txt and in the
// reference's header: lines split after every "\n" (a trailing line without
// one is a line too); common prefix, then common suffix; between them
// Myers's greedy search that keeps, on each diagonal, the path furthest into
// the old text, preferring the deletion when deletion and insertion reach the
// same point, never moving past either text's end, pruning no edge diagonal,
// and following every run of equal lines as far as it goes; the first path to
// reach both ends is the script. The patch is rendered with 3 lines of
// context, change runs at most 6 kept lines apart sharing a hunk, deletions
// before insertions inside a run, and a "%" line after a line that ends its
// text without a newline.
//
// Speed comes from structure, not from a different answer: lines are
// interned to small integers once (one shared map for both texts), the
// search runs on Int32Arrays with a single flat trace (one Int32Array,
// triangular layout, reused across calls), the script is recovered by
// backtracking that trace with the same tie-break the forward search used,
// and the patch is built as an array of fragments joined once.

const KEEP = 0;
const DELETE = 1;
const INSERT = 2;

/** Flat trace of the forward search, reused across calls (grows as needed). */
let trace = new Int32Array(1 << 20);
let traceCap = 1 << 20;

function ensureTrace(n) {
  if (n <= traceCap) return;
  let c = traceCap;
  while (c < n) c *= 2;
  const nt = new Int32Array(c);
  nt.set(trace);
  trace = nt;
  traceCap = c;
}

/**
 * makefun-diff 1.0.0's answer for one case's input: { old, new } -> patch string.
 */
export function run(input) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const oldText = input.old;
  const newText = input.new;

  // ---- tokenize + intern -----------------------------------------------
  // A line is its text without "\n" plus whether it had one. Split gives the
  // parts; every part but the last had a "\n", the last has one only when the
  // text does not end in "\n" (and a trailing "" part after a final "\n" is
  // no line at all, as is the single "" part of the empty text).
  // Interning key: the part string; the line id packs (part id, had-newline)
  // so two lines are equal exactly when their ids are equal.
  const vocab = new Map();
  const uniq = [];
  const intern = (part) => {
    let id = vocab.get(part);
    if (id === undefined) {
      id = uniq.length;
      vocab.set(part, id);
      uniq.push(part);
    }
    return id;
  };

  const aParts = oldText.split('\n');
  const bParts = newText.split('\n');
  const n = aParts.length - (aParts[aParts.length - 1] === '' ? 1 : 0);
  const m = bParts.length - (bParts[bParts.length - 1] === '' ? 1 : 0);
  const aIds = new Int32Array(n);
  const bIds = new Int32Array(m);
  for (let i = 0; i < n; i++) {
    // every line but the last has a "\n"; the last has one only when the text
    // does not end in "\n" is false, i.e. lines before the last part always
    // had one, and the last line has one exactly when it is not the final part.
    const last = i === aParts.length - 1;
    aIds[i] = (intern(aParts[i]) << 1) | (last ? 1 : 0);
  }
  for (let i = 0; i < m; i++) {
    const last = i === bParts.length - 1;
    bIds[i] = (intern(bParts[i]) << 1) | (last ? 1 : 0);
  }

  // ---- common prefix, then common suffix of what is left ---------------
  let prefix = 0;
  const pn = n < m ? n : m;
  while (prefix < pn && aIds[prefix] === bIds[prefix]) prefix++;
  let suffix = 0;
  const sn = n - prefix;
  const sm = m - prefix;
  const snm = sn < sm ? sn : sm;
  while (suffix < snm && aIds[n - 1 - suffix] === bIds[m - 1 - suffix]) suffix++;

  const N = n - prefix - suffix;
  const M = m - prefix - suffix;
  const aOff = prefix;
  const bOff = prefix;

  // ---- Myers's greedy search on the middle, with a trace ---------------
  // V[d][k] (k = x - y, x old lines consumed) lives at trace[d*d + (k + d)].
  // A diagonal with no candidate is -1. Every slot of a row is written while
  // that row runs, so no slot is ever read before it is written.
  const aMid = aIds.subarray(aOff, aOff + N);
  const bMid = bIds.subarray(bOff, bOff + M);
  let D = 0;
  if (N !== 0 || M !== 0) {
    // d = 0: the snake from (0, 0).
    let x = 0;
    let y = 0;
    while (x < N && y < M && aMid[x] === bMid[y]) { x++; y++; }
    trace[0] = x;
    if (x === N && y === M) {
      D = 0;
    } else {
      let found = -1;
      for (let d = 1; d <= N + M && found < 0; d++) {
        const base = d * d;
        ensureTrace(base + 2 * d + 1);
        // ensureTrace may have replaced the buffer; re-read it.
        const T = trace;
        const prevBase = (d - 1) * (d - 1);
        // Row d-1's slots for k-1 and k+1 sit at prevBase + (k-1) + (d-1) and
        // prevBase + (k+1) + (d-1); both move by 2 as k moves by 2, so the
        // indices run alongside k. The edge diagonals have one candidate
        // missing: k = -d has no deletion, k = d has no insertion.
        let pIdx = prevBase - 2; // index of V[d-1][k-1] for the current k
        let nIdx = prevBase; // index of V[d-1][k+1] for the current k
        for (let k = -d, idx = base; k <= d; k += 2, idx += 2, pIdx += 2, nIdx += 2) {
          const vPrev = k === -d ? -1 : T[pIdx];
          const vNext = k === d ? -1 : T[nIdx];
          // Deletion from k-1 consumes old line vPrev (valid while vPrev < N);
          // insertion from k+1 consumes new line vNext - (k+1) (valid while < M).
          const xd = (vPrev !== -1 && vPrev < N) ? vPrev + 1 : -1;
          const xi = (vNext !== -1 && (vNext - (k + 1)) < M) ? vNext : -1;
          if (xd === -1 && xi === -1) {
            T[idx] = -1;
            continue;
          }
          // Further into the old text wins; the deletion wins a tie.
          let xx = xd >= xi ? xd : xi;
          let yy = xx - k;
          while (xx < N && yy < M && aMid[xx] === bMid[yy]) { xx++; yy++; }
          T[idx] = xx;
          if (xx === N && yy === M) { found = d; break; }
        }
      }
      if (found < 0) throw new Error('makefun-diff: the search ended without reaching both ends');
      D = found;
    }
  }

  // ---- backtrack the trace into runs (reversed), same tie-break --------
  // Collected from the end backwards: each step contributes the snake's
  // KEEP run, then the one edit that led into it.
  const rev = [];
  if (D > 0) {
    let k = N - M;
    let x = N;
    let y = M;
    for (let d = D; d >= 1; d--) {
      const prevBase = (d - 1) * (d - 1);
      const prevOff = d - 1;
      const lo = -(d - 1);
      const hi = d - 1;
      let vPrev = -1;
      let vNext = -1;
      if (k - 1 >= lo) vPrev = trace[prevBase + (k - 1) + prevOff];
      if (k + 1 <= hi) vNext = trace[prevBase + (k + 1) + prevOff];
      const xd = (vPrev !== -1 && vPrev < N) ? vPrev + 1 : -1;
      const xi = (vNext !== -1 && (vNext - (k + 1)) < M) ? vNext : -1;
      const isDel = xd !== -1 && (xi === -1 || xd >= xi);
      const prevK = isDel ? k - 1 : k + 1;
      const prevX = isDel ? vPrev : vNext;
      const prevY = prevX - prevK;
      // The edit step lands at (prevX + 1, prevY) for a deletion, or at
      // (prevX, prevY + 1) for an insertion; the snake runs from there to (x, y).
      const sx = isDel ? prevX + 1 : prevX;
      const keeps = x - sx;
      if (keeps > 0) rev.push(KEEP, keeps);
      rev.push(isDel ? DELETE : INSERT, 1);
      x = prevX;
      y = prevY;
      k = prevK;
    }
    if (x > 0) rev.push(KEEP, x);
  }

  // Runs in order: the prefix, the middle (reversed back), the suffix.
  // rev holds [kind, count] pairs from the end backwards; merge neighbours
  // of one kind while reversing, as the reference's components already are.
  const runs = [];
  const pushRun = (kind, count) => {
    if (count <= 0) return;
    const L = runs.length;
    if (L >= 2 && runs[L - 2] === kind) runs[L - 1] += count;
    else runs.push(kind, count);
  };
  pushRun(KEEP, prefix);
  for (let i = rev.length - 2; i >= 0; i -= 2) pushRun(rev[i], rev[i + 1]);
  pushRun(KEEP, suffix);

  // ---- the change runs ---------------------------------------------------
  const changes = [];
  let o = 0;
  let p = 0;
  let deleted = 0;
  let inserted = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const kind = runs[i];
    const count = runs[i + 1];
    if (kind === KEEP) {
      o += count;
      p += count;
      continue;
    }
    let c = changes.length > 0 ? changes[changes.length - 1] : undefined;
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) {
      c = { o, p, dels: 0, ins: 0 };
      changes.push(c);
    }
    if (kind === DELETE) {
      c.dels += count;
      o += count;
      deleted += count;
    } else {
      c.ins += count;
      p += count;
      inserted += count;
    }
  }

  // ---- the hunks ---------------------------------------------------------
  const CONTEXT = 3;
  const hunks = [];
  for (const c of changes) {
    const h = hunks.length > 0 ? hunks[hunks.length - 1] : undefined;
    const prev = h !== undefined ? h[h.length - 1] : undefined;
    if (prev !== undefined && c.o - (prev.o + prev.dels) <= 2 * CONTEXT) h.push(c);
    else hunks.push([c]);
  }

  // ---- render ------------------------------------------------------------
  const out = [`makefun-diff/1 old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  const written = (op, id) => {
    const part = uniq[id >> 1];
    if ((id & 1) === 0) out.push(op + part + '\n');
    else out.push(op + part + '\n%\n');
  };
  for (const h of hunks) {
    const first = h[0];
    const last = h[h.length - 1];
    const oldStart = first.o - CONTEXT > 0 ? first.o - CONTEXT : 0;
    const newStart = first.p - (first.o - oldStart);
    const after = n - (last.o + last.dels) < CONTEXT ? n - (last.o + last.dels) : CONTEXT;
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      for (; at < c.o; at++) written('=', aIds[at]);
      for (let i = 0; i < c.dels; i++) written('-', aIds[c.o + i]);
      for (let i = 0; i < c.ins; i++) written('+', bIds[c.p + i]);
      at = c.o + c.dels;
    }
    for (; at < oldEnd; at++) written('=', aIds[at]);
  }
  return out.join('');
}
