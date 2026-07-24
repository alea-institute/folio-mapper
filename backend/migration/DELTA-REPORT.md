# folio-mapper -> folio-resolve migration — delta report

- baseline capture: `baseline` (folio-resolve consumed: `False`)
- candidate capture: `candidate` (folio-resolve consumed: `True`, version `0.2.0`)
- corpus hash: `acb19030ec8fae29…`

## Buckets

- _(empty — byte-for-byte behavior parity)_

## Canaries

- ✅ PARITY — zero deltas across all six seams
- ✅ PLACES-PRESERVED — place/jurisdiction rows still resolve (no PlaceNameGate leak)
- ✅ STOPWORD-FALLBACK — all-stopword inputs keep their `_tokenize()` fallback
