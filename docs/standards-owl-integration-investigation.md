# Standards → OWL Integration Investigation

**Item:** folio-mapper II.6.0 (SSSOM → OWL converter for external-standard mappings)
**Mode:** READ-ONLY investigation. No OWL edits, no commits to the FOLIO repo were made.
**Date:** 2026-07-07

---

## Findings

### 1. There is NO `standards-compatibility` branch (or any standards/mapping/SSSOM branch)

Checked local, `origin` (damienriehl/FOLIO), and `upstream` (alea-institute/FOLIO) after a read-only `git fetch --prune` on both remotes, plus the GitHub API for branches and all-state PRs.

Every branch that exists:

```
origin/main, origin/HEAD
origin/add-risk-tolerance-capacity
origin/add-synonyms-appellate-appeal
origin/add-synonyms-dui
origin/add-synonyms-food-public-benefit
origin/add-synonyms-patent-registration
origin/claude/setup-deployment-platform-7LfvN
upstream/main, upstream/HEAD
upstream/1.0.0, upstream/2.0.0
upstream/claude/fix-pr-merge-error-cVbqC
upstream/ontology-enhancements-refund-preflabels
```

`git branch -a | grep -iE 'standard|map|sssom|skos|compat|crosswalk|xref'` → **no matches.** GitHub PR titles (all states) filtered for `standard|map|sssom|skos|crosswalk|compat|naics|lkif|akoma|external` → **no matches.**

**Conclusion:** the converter must *establish* the mapping pattern, so it should follow the modeling that FOLIO already uses for cross-references to external sources, described below. There is no pre-existing SSSOM/mapping graph to conform to.

### 2. How FOLIO currently models external-standard cross-references

The entire ontology is a single file, **`/home/damienriehl/Coding Projects/folio/FOLIO.owl`** (~18 MB, RDF/XML), namespace base `https://folio.openlegalstandard.org/`. Concepts are `owl:Class` nodes with opaque R-prefixed IRIs (e.g. `R7vfM0J4fZ9NCcg884uxgv8`).

The modeling answer to the task's three options:

- **It is annotation properties on existing FOLIO concepts** — NOT node-per-external-concept, and NOT a separate SSSOM-style mapping graph. External codes/refs are added as extra annotation triples *inside the existing `owl:Class` block*.
- **No SKOS mapping predicates are used at all.** Counts across the whole file: `skos:exactMatch` = 0, `skos:closeMatch` = 0, `skos:relatedMatch/broadMatch/narrowMatch/related` = 0. So there is no established `skos:*Match` convention to inherit — adopting it would be a *new* choice (a defensible one, see design).

Namespace prefixes declared in the OWL header (`FOLIO.owl` lines 1–12):

```xml
xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns:v1="http://www.loc.gov/mads/rdf/v1#"      <!-- madsrdf -->
xmlns:skos="http://www.w3.org/2004/02/skos/core#"
xmlns:folio="https://folio.openlegalstandard.org/"
```

Note: it uses **DC Elements 1.1** (`purl.org/dc/elements/1.1/`), not DC Terms. No `dcterms:`, no `sssom:`, no `prov:` prefix is declared.

#### Pattern A — custom per-standard annotation property carrying the external code (the closest existing analog to a real mapping)

FOLIO maps its litigation/practice concepts to the **ABA UTBMS** code set (Uniform Task-Based Management System) via two **custom annotation properties** whose values are the external codes. The properties are declared (labels only) near the top of the file and applied on ~24 concept classes.

Declarations (`FOLIO.owl` lines 54–66):

```xml
<owl:AnnotationProperty rdf:about="https://folio.openlegalstandard.org/RBwBJ2lKdRgVYPkQmoJN1pD">
    <rdfs:label>utbmsma:phase</rdfs:label>
</owl:AnnotationProperty>
<owl:AnnotationProperty rdf:about="https://folio.openlegalstandard.org/RCAWR19VGcj184M2SBAaeoj">
    <rdfs:label>utbmsma:task</rdfs:label>
</owl:AnnotationProperty>
```

Application on a concept (`FOLIO.owl` ~line 71154, concept `R7vfM0J4fZ9NCcg884uxgv8`, "M&A A Preliminary Matters Practice"):

```xml
<owl:Class rdf:about="https://folio.openlegalstandard.org/R7vfM0J4fZ9NCcg884uxgv8">
    <rdfs:subClassOf rdf:resource=".../RVLgJukt9MTZNfTewtxNIK"/>
    <!-- internal cross-ref to the canonical concept, via an owl:sameAs restriction -->
    <rdfs:subClassOf>
        <owl:Restriction>
            <owl:onProperty rdf:resource="http://www.w3.org/2002/07/owl#sameAs"/>
            <owl:someValuesFrom rdf:resource=".../RBso92NcgN204DAOkEBcGuD"/>
        </owl:Restriction>
    </rdfs:subClassOf>
    <RBwBJ2lKdRgVYPkQmoJN1pD>MA00</RBwBJ2lKdRgVYPkQmoJN1pD>   <!-- utbmsma:phase = MA00 -->
    <rdfs:label>M&amp;A A Preliminary Matters Practice</rdfs:label>
    ...
</owl:Class>
```

The external standard's code (`MA00`, `MF80`, …) is a **literal value on a standard-specific annotation property**. This is the single most relevant precedent for II.6.0.

#### Pattern B — `dc:source` for the external authority (URI or literal)

385 `dc:source` triples. Used two ways on existing classes:

- As a **resource reference** to an external standard/document URL:

```xml
<!-- FOLIO.owl line 13241, concept R0BHGyWXHS3W4mQgpdjoIk "Chronic Liver Disease" -->
<dc:source rdf:resource="https://www.ssa.gov/disability/professionals/bluebook/5.00-Digestive-Adult.htm#5_05"/>
```

(FOLIO's disability/medical concepts are keyed to the **SSA "Blue Book"** Listing of Impairments — an external standard mapped by source URL. Others point to Wikipedia, e.g. Plutchik's wheel of emotions.)

- As a **literal** naming the source corpus:

```xml
<dc:source>ABA M&amp;A Deal Points Study</dc:source>
```

#### Pattern C — `dc:identifier` for structured external/registry codes

5,137 `dc:identifier` triples — structured codes from external registries embedded as literals on the class:

```xml
<dc:identifier>US-FD-USPS</dc:identifier>       <!-- US federal agency code -->
<dc:identifier>EUR-NO-NO+10</dc:identifier>     <!-- ISO-style geo: Vest-Agder, Norway -->
<dc:identifier>BHD</dc:identifier>              <!-- ISO 4217 currency: Bahraini Dinar -->
```

#### Pattern D — `skos:notation` for FOLIO-internal machine codes (NOT external)

212 `skos:notation` values, all `folio:`-prefixed internal enums, e.g. `folio:contested`, `folio:owned`. This is FOLIO's own code space, not an external mapping — don't reuse it for standards.

#### Anti-pattern — `rdfs:seeAlso` is misused here; do NOT follow it

28 `rdfs:seeAlso` triples, but every one inspected holds **prose definition text**, not a URI or concept reference (e.g. a paragraph describing "Real Estate Agreement"). It is effectively a stray second definition, not a cross-reference. Do not model standards mappings with `rdfs:seeAlso`.

#### Provenance recorded today

Minimal. `dc:source` (authority, sometimes a deep-link to a specific listing) and `dc:identifier`/custom-property values (the code). **No confidence score, no mapping-review/reviewer field, no standard version, and no mapping date** are recorded anywhere. There is no reification/PROV, no mapping-justification predicate. This is the gap SSSOM provenance will fill.

### 3. Tooling in the sibling repos a converter should follow

- **folio-python** (`/home/damienriehl/Coding Projects/folio-python/`) parses `FOLIO.owl` with **`lxml.etree`** (dep `lxml>=5.2.2` in `pyproject.toml`; used in `folio/graph.py`, `folio/models.py`). It treats the OWL as XML, not as an RDF graph. No `rdflib`, no `sssom`. Good reference for *reading* FOLIO and for the exact XML shape a PR diff must match.
- **folio-enrich** (`/home/damienriehl/Coding Projects/folio-enrich/`) already depends on **`rdflib>=7.0.0`** (`backend/pyproject.toml`) and has a working RDF serializer at **`backend/app/services/export/rdf_exporter.py`**. It imports `from rdflib import BNode, Graph, Literal, Namespace, URIRef` and `from rdflib.namespace import DCTERMS, OWL, RDF, RDFS, SKOS, XSD`, binds prefixes (`g.bind("skos", SKOS)`, ontology NS from `job.result.base_iri`), builds triples, and serializes Turtle (`content_type = "text/turtle"`). **This is the serialization pattern the converter should mirror** — same library, same namespace-binding style, ontology-neutral base IRI. (Enrich also models annotations with W3C Web Annotation `oa:` and OWL `NamedIndividual`s; not directly needed for additive class-level mappings.)

**Serialization-format caveat:** FOLIO ships as **RDF/XML**, and folio-python round-trips it as XML with lxml. rdflib's RDF/XML serializer reorders and re-formats the entire file, which would produce an unreadable PR diff against `FOLIO.owl`. See the design's "canonical serialization" note — emit mapping triples as a **separate additive artifact** and/or splice them into the class blocks with an XML-aware writer rather than re-serializing the whole ontology through rdflib.

---

## SSSOM → OWL converter design (follows the existing pattern)

The converter takes an SSSOM mapping set (TSV/JSON from `sssom-py`, one row per `subject → object` mapping) where **subject = a FOLIO concept IRI** and **object = an external-standard concept/code**, and emits additive OWL annotation triples on the existing FOLIO class — mirroring Pattern A/B above. Mappings are purely additive (no class is created or deleted), which is why this is the lowest-risk first use of the write-back pipeline.

### SSSOM field → OWL predicate mapping

| SSSOM slot | Meaning | OWL output on the FOLIO subject class |
|---|---|---|
| `subject_id` | FOLIO concept IRI | The `rdf:about` of the `owl:Class` receiving the triples (must already exist) |
| `subject_label` | FOLIO label | Not written (already on the class); used for diff-review sanity only |
| `object_id` | External concept IRI/CURIE | Object of the mapping predicate — `rdf:resource` if a resolvable URI, else literal code |
| `object_label` | External concept label | Optional literal, e.g. as an annotation on a reified mapping node |
| `predicate_id` | SKOS/OWL match predicate | Chooses the mapping predicate (see below) |
| `mapping_justification` | SEMAPV justification | Provenance annotation on the mapping (reviewer vs. lexical vs. logical) |
| `confidence` | 0.0–1.0 | Provenance annotation (`sssom:confidence` / literal) |
| `author_id` / `reviewer_id` | who asserted/approved | Provenance annotation (reviewer) |
| `mapping_date` | when | Provenance annotation |
| `mapping_set_version` / `object_source_version` | standard version | Provenance annotation (standard version) |
| `mapping_set_id` / `object_source` | the external standard | `dc:source` on the mapping (authority), following Pattern B |

**Predicate selection (`predicate_id` → OWL):**

| SSSOM `predicate_id` | OWL predicate emitted |
|---|---|
| `skos:exactMatch` | `skos:exactMatch` |
| `skos:closeMatch` | `skos:closeMatch` |
| `skos:broadMatch` | `skos:broadMatch` |
| `skos:narrowMatch` | `skos:narrowMatch` |
| `skos:relatedMatch` | `skos:relatedMatch` |
| `owl:equivalentClass` (only if human-confirmed exact) | `owl:equivalentClass` — use sparingly; logical, not just an annotation |

Recommendation: **default to `skos:*Match` annotation properties.** They are the SSSOM-native, standards-community-expected predicates, they are additive/non-logical (safe), and — critically — FOLIO already ships the `skos:` prefix and uses SKOS heavily (`skos:definition`, `skos:prefLabel`, `skos:altLabel`, `skos:notation`), so this rides existing namespace conventions without inventing anything. Where a standard has no resolvable IRI (only a bare code, like UTBMS `MA00`), follow **Pattern A**: keep the code as a literal on a per-standard custom annotation property (or as the `object_id` literal object of the match predicate) and record the standard via `dc:source`.

### How a confirmed mapping becomes OWL axioms

Two complementary emission shapes; pick per whether the object has a resolvable IRI and whether provenance must be attached.

**(a) Flat annotation (simplest, matches Pattern A/B exactly) — object has a URI:**

```xml
<!-- spliced into the existing owl:Class for the FOLIO subject -->
<owl:Class rdf:about="https://folio.openlegalstandard.org/R7vfM0J4fZ9NCcg884uxgv8">
    ...existing triples unchanged...
    <skos:exactMatch rdf:resource="https://external.example.org/standard/CODE123"/>
    <dc:source rdf:resource="https://external.example.org/standard/"/>
</owl:Class>
```

**(b) Flat annotation — object is a bare code (UTBMS-style, Pattern A):**

```xml
    <skos:exactMatch>utbmsma:MA00</skos:exactMatch>
    <dc:source>ABA UTBMS 2007</dc:source>
```

**(c) Reified mapping (when confidence/reviewer/version must be attached) — SSSOM's own OWL axiom-annotation style via `owl:Axiom`:**

```xml
<owl:Axiom>
    <owl:annotatedSource rdf:resource="https://folio.openlegalstandard.org/R7vfM0J4fZ9NCcg884uxgv8"/>
    <owl:annotatedProperty rdf:resource="http://www.w3.org/2004/02/skos/core#exactMatch"/>
    <owl:annotatedTarget rdf:resource="https://external.example.org/standard/CODE123"/>
    <sssom:confidence rdf:datatype="xsd:decimal">0.95</sssom:confidence>
    <sssom:mapping_justification rdf:resource="https://w3id.org/semapv/vocab/ManualMappingCuration"/>
    <sssom:reviewer_id>ORCID:0000-0000-0000-0000</sssom:reviewer_id>
    <sssom:object_source_version>2007</sssom:object_source_version>
    <dc:date>2026-07-07</dc:date>
    <dc:source rdf:resource="https://external.example.org/standard/"/>
</owl:Axiom>
```

Use **(a)/(b) for the human-facing triple** and add **(c) only when provenance metadata is present** — this keeps the common case a clean one-liner (like today's UTBMS triples) while giving SSSOM provenance a lossless home. The converter should declare the referenced annotation properties (`skos:*Match` are in SKOS already; declare `sssom:confidence`, `sssom:mapping_justification`, etc. as `owl:AnnotationProperty` once, the same way FOLIO declares `utbmsma:phase`).

### Provenance annotations to record (fills the current gap)

Per confirmed mapping: **source standard** (`dc:source` → authority IRI/name), **standard version** (`sssom:object_source_version`), **confidence** (`sssom:confidence`, xsd:decimal), **justification** (`sssom:mapping_justification` → SEMAPV term, distinguishing human-confirmed from lexical/auto), **reviewer** (`sssom:reviewer_id`/`author_id`), and **date** (`dc:date`). Only human-**confirmed** mappings are written to the OWL; lower-confidence candidates stay in the SSSOM set in the mapper's own store.

### Canonical serialization for clean PR diffs

- **Do not re-serialize `FOLIO.owl` through rdflib's RDF/XML writer** — it reorders/reformats the whole file and yields a diff touching every line. folio-python round-trips with `lxml.etree`; the write-back must produce a **minimal, additive diff**.
- **Preferred:** an **XML-aware splicer** (lxml, matching folio-python's approach): locate the target `<owl:Class rdf:about="…subject_id">`, append the new annotation child element(s) in a **canonical, sorted position** (e.g. mapping predicates grouped and alphabetized by predicate then object), preserve existing indentation (4 spaces) and the file's element ordering. This makes each mapping a few added lines, reviewable in a PR.
- **Alternative / companion artifact:** emit mappings to a **separate sidecar file** (e.g. `mappings/<standard>.ttl` in Turtle via rdflib, following folio-enrich's `rdf_exporter.py` binding style, or `owl:Axiom` blocks in a separate RDF/XML file `imports`-linked from the ontology). This isolates all mapping churn from `FOLIO.owl` entirely and is the cleanest for review, at the cost of FOLIO needing to load/merge the sidecar. Recommend the **sidecar-per-standard** artifact as the default, with optional inline splice if/when FOLIO maintainers want the triples in the main file.
- Serialize deterministically: stable triple ordering, LF line endings, one mapping per line/block, so re-running the converter on an unchanged SSSOM set produces a byte-identical file (no spurious diffs).

### Riding the Workstream B write-back staging

Mappings are the **first and lowest-risk** production use of the write-back pipeline (additive-only, no deletions, no class creation). Flow:

1. **Generate** — converter reads the confirmed SSSOM set for one standard, produces the additive artifact (sidecar `.ttl`/RDF-XML, or spliced `FOLIO.owl`).
2. **Sandbox repo first** — commit to the sandbox/fork (`damienriehl/FOLIO` or a dedicated mappings fork), never directly to `upstream/main`. Branch per run, e.g. `mappings/<standard>-<date>`.
3. **Permanent PR gate** — every write reaches upstream only through a PR that a human reviews and merges; the converter never auto-merges. This matches the task's "permanent PR gate" requirement and FOLIO's existing PR-per-change norm (cf. the `add-synonyms-*` branches).
4. **Digest PRs per standard** — batch one standard's confirmed mappings into a single PR (title e.g. "Add UTBMS mappings (N concepts)"), not one PR per triple, so review is coherent. Include a summary table (subject label → object code, confidence, reviewer) in the PR body generated from the SSSOM set.
5. **Idempotent re-runs** — before adding a triple, check the target class doesn't already carry it, so re-running against an updated SSSOM set only adds net-new mappings.

### Library choices (follow the siblings)

- **Read FOLIO / splice XML:** `lxml.etree` (as folio-python does) — preserves the RDF/XML shape for clean diffs.
- **Build/serialize RDF sidecar:** `rdflib>=7.0.0` with the `rdflib.namespace` prefixes (`SKOS`, `OWL`, `RDF`, `RDFS`, `XSD`, `DCTERMS`) exactly as folio-enrich's `rdf_exporter.py` — Turtle output for the sidecar.
- **Parse SSSOM:** `sssom-py` (the standards-community library) for reading/validating the mapping set and its metadata header (curie_map, mapping_set_version, license).

---

## Open questions (human decisions)

1. **Predicate default — `skos:exactMatch` vs. `owl:equivalentClass`.** FOLIO uses zero SKOS match predicates today, so this is a fresh convention. Recommend `skos:*Match` (safe, SSSOM-native). Do FOLIO maintainers want any mappings promoted to logical `owl:equivalentClass`? That has reasoning consequences and should be opt-in per-mapping.
2. **Inline splice into `FOLIO.owl` vs. sidecar file.** Do maintainers want mapping triples living inside `FOLIO.owl` (matches the UTBMS precedent, one file) or in a separate imported `mappings/<standard>` artifact (cleanest diffs, but changes how consumers load FOLIO)? This is the single biggest structural decision.
3. **Provenance vocabulary.** FOLIO currently declares only DC **Elements 1.1**, not DC Terms, SSSOM, or PROV. Approve introducing `sssom:` (and possibly `dcterms:`/`semapv:`) prefixes and declaring the SSSOM annotation properties as `owl:AnnotationProperty`? Or keep provenance minimal (just `dc:source` + a confidence literal) to match the terse existing style?
4. **Bare-code standards (UTBMS-style).** For standards with no resolvable IRI, keep the code as a literal on a per-standard custom annotation property (like `utbmsma:phase`) *and* a `skos:exactMatch` literal, or only one of them? Need a consistent rule so lookups are predictable.
5. **Object IRI minting for external concepts.** When an external standard has stable IRIs, use them directly. When it only has codes, does the mapper mint a canonical CURIE/IRI (e.g. `utbmsma:MA00`) and register its prefix in the SSSOM `curie_map`? Who owns that prefix registry?
6. **Confidence threshold for write-back.** What minimum confidence / which `mapping_justification` values qualify a mapping to be written to the OWL PR vs. held in the mapper's candidate store? (Task says "confirmed" — need the operational definition of confirmed.)
7. **Which standards first.** UTBMS is already partially in FOLIO (phase/task). Is completing/normalizing UTBMS the pilot, or does a cleaner external standard (with real IRIs) make a better first digest PR?
