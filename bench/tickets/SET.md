# Ticket set: dev vs held-out

Per the benchmark spec (section 3, "Dev/held-out split"): 4 tickets are the
dev set, used to build and tune the G graph system; the other 12 are
held-out, frozen and unseen by G's builders until the scored runs. P and N
are never tuned regardless of set.

## Dev set (4)

- **T01** — trivial (customer orders endpoint)
- **T05** — medium (sortable order list)
- **T07** — medium (discount stacking)
- **T12** — ambiguous (orders feel slow)

## Held-out set (12)

T02, T03, T04 (trivial); T06, T08, T09 (medium); T10, T11 (cross-repo); T13,
T14 (ambiguous); T15, T16 (reject).

## Composition check

| Class | Ids | Count |
|---|---|---|
| Trivial | T01, T02, T03, T04 | 4 |
| Medium | T05, T06, T07, T08, T09 | 5 |
| Cross-repo | T10, T11 | 2 |
| Ambiguous | T12, T13, T14 | 3 |
| Reject | T15, T16 | 2 |
| **Total** | | **16** |

Dev set composition matches the spec's requirement exactly: 1 trivial, 2
medium (T05, T07), 1 ambiguous.
