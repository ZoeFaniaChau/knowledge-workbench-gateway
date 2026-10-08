# Content Sync Contract

## Scope

This document defines the current content contract across the Personal Digital Infrastructure's editorial CMS, the `knowledge-workbench-gateway`, the GitHub knowledge repository, and the `orlando-web` application model.

It distinguishes two related but different flows:

1. **Editorial application model:** Notion is the current canonical editorial CMS for `orlando-web`. The website consumes that content through an application-level CMS adapter.
2. **Knowledge export flow:** selected Notion pages are projected by `knowledge-workbench-gateway` into Markdown files in the `ZoeFaniaChau/knowledge-workbench` repository. The gateway uses a GitHub manifest to map Notion page IDs to exported file paths.

The gateway is therefore **not currently a full serializer of the website's Content entity**. It is a selective Markdown export pipeline.

## Canonical Content Object

At the editorial layer, the canonical logical object is the Notion **Content** item described by the website architecture.

The current website model defines Content with:

- id
- title
- slug
- type
- status
- publishedAt
- excerpt
- coverUrl
- featured
- seoTitle
- seoDescription
- externalUrl
- body
- createdAt
- updatedAt
- project relations
- tag relations
- media relations
- related-content relations

The gateway does not currently retrieve or serialize this complete object.

For a GitHub-targeted page, the gateway currently uses a smaller export object:

- Notion page ID
- Title
- Kind
- Output Target
- GitHub Path
- Notion block content

The manifest stores the page ID as the object key and stores Title, Kind, and Path as the manifest entry.

## Field Mapping

| Concept | Notion | Gateway | GitHub export | Website application / DB | Authoritative Source |
|---|---|---|---|---|---|
| Identity | Page ID | Used as manifest object key and sync lookup key | Not embedded in Markdown | `Content.id` is a separate application identifier | Notion page identity for editorial/export linkage |
| Title | `Title` property | Read by `getPageTitle()` | Markdown H1 | `Content.title` | Notion |
| Slug | Defined by website Content model | Not read by current page sync | Not represented | `Content.slug` | Notion/editorial CMS when populated |
| Type / kind | `Kind` property for manifest selection | Copied into manifest as `kind` | Not embedded in exported Markdown | `Content.type` | Notion |
| Editorial status | Content model includes Draft/Review/Published/Archived | Not read by `syncNotionPage()` | Not represented | `Content.status` | Notion |
| Published At | Notion Content field | Not read | Not represented | `Content.publishedAt` | Notion |
| Excerpt | Notion Content field | Not read | Not represented | `Content.excerpt` | Notion |
| Cover URL | Notion Content field | Not read | Not represented | `Content.coverUrl` | Notion |
| Featured | Notion Content field | Not read | Not represented | `Content.featured` | Notion |
| SEO Title | Notion Content field | Not read | Not represented | `Content.seoTitle` | Notion |
| SEO Description | Notion Content field | Not read | Not represented | `Content.seoDescription` | Notion |
| External URL | Notion Content field | Not read | Not represented | `Content.externalUrl` | Notion |
| Body | Notion blocks | Rendered with `blockToMarkdown()` / `renderBlocks()` | Markdown body | `Content.body` / `BodyBlock[]` | Notion block content |
| Tags | Native Notion relation | Not read by current page export | Not represented | `ContentTag[]` / `Tag[]` | Notion |
| Project | Native Notion relation | Not read | Not represented | `ContentProject[]` / `projectIds` | Notion |
| Media | Native Notion relation | Not read | Not represented | `ContentMedia[]` / `MediaAsset[]` | Notion |
| Related Content | Native Notion relation | Not read | Not represented | `ContentRelated[]` / `relatedContentIds` | Notion |
| GitHub output eligibility | `Output Target` includes `GitHub` | Determines whether a manifest entry exists | Manifest controls which pages are exported | Not an application Content field | Notion |
| GitHub path | `GitHub Path` | Validated and stored in manifest | File path | Not an application Content field | Notion |
| GitHub file URL | Derived after sync | Constructed after successful write | Points to exported file | Not currently part of Content model | Gateway |
| GitHub file SHA | Notion property `GitHub Last Synced SHA` after sync | Returned as `fileSha`; written back to Notion | GitHub Contents API file SHA | Not currently part of Content model | GitHub |
| GitHub commit SHA | Not a current Notion Content field | Returned as `commitSha` from successful write | Git commit identity | Not currently part of Content model | GitHub |
| Sync status | `GitHub Sync Status` | Writes Pending/Synced/Error | Not represented | Not currently part of Content model | Gateway synchronization state |
| Last synced time | `GitHub Last Synced` | Generated after GitHub operation | Not represented | Not currently part of Content model | Gateway synchronization state |
| Last edited | Notion Content field | Not read by current page sync | Not represented | `updatedAt` / CMS Last Edited concept | Notion |

## Transformations

The current page synchronization path is:

```
Notion page
  -> page properties
  -> manifest lookup by Notion page ID
  -> Notion page title
  -> Notion block children
  -> Markdown rendering
  -> GitHub Contents API
  -> Markdown file in knowledge-workbench
```

For a GitHub-targeted page, `manifest-source.ts` first converts the Notion properties `Title`, `Kind`, `Output Target`, and `GitHub Path` into a manifest candidate. A valid GitHub target becomes a manifest entry keyed by the original Notion page ID.

During content synchronization, `syncNotionPage()` then:

1. reads the manifest;
2. finds the page ID's target path;
3. marks the Notion page `Pending`;
4. fetches the page;
5. fetches all block children;
6. renders those blocks as Markdown;
7. writes or skips the corresponding GitHub file;
8. records the resulting GitHub file SHA, URL, and synchronization time in Notion;
9. returns both the GitHub file SHA and commit SHA to the caller.

The important distinction is that the **GitHub file is a projection**, not the canonical Content record.

## Fields That Are Not Preserved

The current GitHub Markdown export intentionally or incidentally omits most application metadata.

Not currently preserved in the exported Markdown:

- Notion page ID
- slug
- editorial status
- publication timestamp
- excerpt
- cover
- featured flag
- SEO metadata
- external URL
- tags
- project relations
- media relations
- related-content relations
- created/updated timestamps

The manifest preserves only a subset of identity/routing metadata:

```json
{
  "page-id": {
    "title": "...",
    "kind": "...",
    "path": "..."
  }
}
```

Therefore, the Markdown file itself cannot currently be treated as a self-describing representation of the original Notion Content object.

## Identity

There are currently three distinct identities and they must not be conflated:

- **Notion page ID:** editorial source identity and manifest key.
- **GitHub file SHA:** identity of the current Git blob represented by the Contents API.
- **Git commit SHA:** identity of the Git commit produced by a successful write.

The gateway correctly distinguishes the last two at runtime. The Notion property `GitHub Last Synced SHA` currently stores the **GitHub file SHA**, not the commit SHA. The commit SHA is returned by `syncNotionPage()` but is not persisted to Notion.

The GitHub path is a routing coordinate, not a stable content identity. It can change independently of the Notion page ID.

## State

Content state and synchronization state are separate dimensions.

**Content state** belongs to the editorial domain:

```
Draft -> Review -> Published -> Archived
```

**Synchronization state** belongs to the integration domain:

```
Pending -> Synced
        \-> Error
```

The current gateway does not treat GitHub synchronization as the publication workflow. A page can therefore be editorially Draft while being technically synchronized to GitHub.

This separation is correct and should be preserved.

The current `Synced` state means that the gateway completed its GitHub write/read comparison and then successfully wrote the synchronization metadata back to Notion. It does not mean that every field of the website Content model was exported to GitHub.

## Invariants

The following properties should remain true:

1. A GitHub export is always attributable to exactly one Notion page through the manifest object key.
2. A page is exported only when its `Output Target` contains `GitHub`.
3. The manifest path is treated as a routing target and must pass GitHub path validation.
4. `GitHub Last Synced SHA` represents the GitHub **file SHA**, not the commit SHA.
5. Content identity must not be inferred from the GitHub file SHA or commit SHA.
6. Editorial publication state must not be inferred from GitHub synchronization state.
7. A skipped GitHub write is still a successful synchronization outcome when the existing GitHub content is byte-for-byte equivalent to the generated Markdown.
8. The website's application-level Content model must remain independent of raw Notion property names and GitHub file representation.
9. A future PostgreSQL implementation must be able to replace Notion as the application's storage implementation without making GitHub Markdown the new canonical database model.

## Current Contract Gaps

The most important gap is **self-describing identity at the GitHub artifact boundary**.

The manifest knows the Notion page ID, but the Markdown file does not. If the file is inspected independently of the manifest, its provenance cannot be established from the file itself. The path is insufficient because paths are routing data and may change.

A second, related limitation is that the GitHub export is intentionally much smaller than the website Content model. This is acceptable only if the two representations remain explicitly treated as different projections. They should not silently converge into an assumption that the GitHub Markdown file is a complete Content record.

A third limitation is that synchronization metadata is asymmetric: the file SHA is persisted to Notion, while the commit SHA is returned by the gateway but not persisted. This is not currently an integrity violation because the file SHA is the value required by the GitHub Contents API for subsequent updates, while the commit SHA identifies the write transaction.

## Decision

**Current contract: sufficient with a documented limitation.**

The architecture currently has a coherent separation:

```
Notion
  = canonical editorial source

knowledge-workbench
  = selective Markdown projection

orlando-web
  = application presentation over the canonical editorial model
```

The gateway should not be expanded into a serializer for every Content field merely because the website model contains those fields. That would couple the knowledge export to the website's presentation/data requirements and undermine the existing storage boundary.

However, the exported Markdown should acquire explicit source identity before the knowledge repository becomes a larger long-lived content store.

## Recommended Next Change

**Add a small, stable YAML frontmatter contract to every gateway-generated Markdown file containing at least the Notion page ID and the manifest kind.**

The resulting artifact should remain human-readable Markdown while carrying machine-readable provenance, for example:

```yaml
---
source: notion
source_page_id: <notion-page-id>
kind: Research
---
```

The page ID should remain the canonical cross-system identity. The GitHub path, file SHA, and commit SHA should remain synchronization/repository metadata rather than replacing that identity.

This should be implemented in the gateway's Markdown generation path and covered by a regression test before any broader metadata export is added.
