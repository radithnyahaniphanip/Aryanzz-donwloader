# ARYANZZ live platform matrix

This diagnostic is intentionally opt-in because it makes public requests to multiple provider and image-search endpoints.

## Coverage

- Iterates every dedicated entry in `src/platform-catalog.js` whose `providerKey` is not `aio`.
- Checks platform title search using a shared public query.
- Uses a returned public result, or an explicitly configured sample URL, to test media extraction.
- For image-capable platforms, checks image search and probes preview/download responses.
- Validates response MIME types and actual media signatures rather than trusting labels alone.
- Writes a machine-readable `platform-matrix.json` artifact.

## Limits

- This is a public-access smoke matrix, not a guarantee that every post or private/restricted URL is downloadable.
- Platforms routed through the generic `aio` provider are outside this dedicated-provider matrix.
- A provider may return no public results for the sample query even when direct-link extraction is supported.
- The matrix records unsupported, blocked, rate-limited, and timed-out cases instead of claiming universal support.
