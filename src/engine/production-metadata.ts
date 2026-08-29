/**
 * ProductionMetadata — clean public-facing metadata rules.
 *
 * Cycle 001 lesson: the corrected master title was
 * "The Minimalist AI Toolkit: Open Source Solutions (v2 - Fact-Verified)"
 * which is useful for development history but should NOT be normal
 * public-facing title behavior.
 *
 * Rule: version/fact-verification state is stored INTERNALLY (in the
 * VideoProject.editorNotes or a dedicated metadata field). The public-facing
 * title is ONLY the selected audience-facing title unless explicitly configured
 * otherwise.
 */
export interface PublicMetadata {
  title: string
  description: string
  tags: string[]
}

export interface InternalMetadata {
  public: PublicMetadata
  internal: {
    version?: string
    factVerified?: boolean
    repairHistory?: string[]
    autonomousCycleId?: string
    developmentNotes?: string
  }
}

/**
 * Build clean public + internal metadata for a production.
 * The public title NEVER includes version/repair suffixes by default.
 */
export function buildProductionMetadata(opts: {
  title: string
  description: string
  tags: string[]
  autonomousCycleId?: string
  version?: string
  factVerified?: boolean
  repairHistory?: string[]
  developmentNotes?: string
}): InternalMetadata {
  return {
    public: {
      title: opts.title,
      description: opts.description,
      tags: opts.tags,
    },
    internal: {
      version: opts.version,
      factVerified: opts.factVerified,
      repairHistory: opts.repairHistory,
      autonomousCycleId: opts.autonomousCycleId,
      developmentNotes: opts.developmentNotes,
    },
  }
}

/**
 * Strip any accidental version/repair suffixes from a title.
 * Defensive — used at the publish boundary to enforce the rule.
 */
export function sanitizePublicTitle(title: string): string {
  // Remove common dev-suffix patterns: "(v2 - Fact-Verified)", "(v3)", " [REPAIR]", etc.
  return title
    .replace(/\s*\(v\d+\s*-\s*[^)]+\)\s*$/i, '')
    .replace(/\s*\(v\d+\)\s*$/i, '')
    .replace(/\s*\[REPAIR[^\]]*\]\s*$/i, '')
    .replace(/\s*\[PRE-?REPAIR\]\s*$/i, '')
    .replace(/\s*-?\s*Fact-Verified\s*$/i, '')
    .trim()
}
