# Anthropic response fixtures

These files are **synthetic**: hand-written in the shape of a Messages API response
(`id`, `type`, `role`, `model`, `content`, `stop_reason`, `usage`). They were not captured
from a live call (no live call is allowed before ruling C4). They contain no request headers,
no keys and no tokens. Used by `tests/unit/anthropic-reasoning.test.ts` through a fake
`messages.create`; no test touches the network.

Replace or supplement them with captured responses only after the C4 live smoke call, and
scrub headers and keys first.
