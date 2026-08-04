import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/data/video-detail?id=<videoProjectId>
// Returns the full detail tree for a produced video:
//   { videoProject, script, scenes, idea, claims, review }
//
// Prisma relation map (verified against prisma/schema.prisma):
//   VideoProject.videoIdea     -> VideoIdea (with pillar, claims, scripts)
//   VideoProject.policyReviews -> PolicyReview[]
//   VideoIdea.scripts          -> Script[] (with scenes)
//   VideoIdea.claims           -> ClaimLedger[]
//   VideoIdea.pillar           -> ContentPillar?
//
// Note: there is no direct `script` or `claims` relation on VideoProject.
// Script lives on VideoIdea (we pick the latest version). Claims live on
// VideoIdea. PolicyReview lives on VideoProject via the `policyReviews` field.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const videoProject = await db.videoProject.findUnique({
    where: { id },
    include: {
      videoIdea: {
        include: {
          pillar: true,
          claims: { orderBy: { createdAt: 'desc' } },
          scripts: {
            include: { scenes: { orderBy: { order: 'asc' } } },
            orderBy: { version: 'desc' },
          },
        },
      },
      policyReviews: { orderBy: { reviewedAt: 'desc' } },
    },
  })

  if (!videoProject) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Flatten / normalize for the frontend consumer.
  const idea = videoProject.videoIdea
  const script = idea?.scripts?.[0] ?? null
  const scenes = script?.scenes ?? []
  const claims = idea?.claims ?? []
  const review = videoProject.policyReviews?.[0] ?? null

  return NextResponse.json({
    videoProject: {
      id: videoProject.id,
      title: videoProject.title,
      status: videoProject.status,
      videoFilePath: videoProject.videoFilePath,
      thumbnailPath: videoProject.thumbnailPath,
      captionPath: videoProject.captionPath,
      resolution: videoProject.resolution,
      duration: videoProject.duration,
      fileSize: videoProject.fileSize,
      renderProgress: videoProject.renderProgress,
      reviewResult: videoProject.reviewResult,
      isApproved: videoProject.isApproved,
      editorNotes: videoProject.editorNotes,
      createdAt: videoProject.createdAt,
      updatedAt: videoProject.updatedAt,
    },
    script: script
      ? {
          id: script.id,
          content: script.content,
          outline: script.outline,
          hook: script.hook,
          callToAction: script.callToAction,
          wordCount: script.wordCount,
          estimatedMinutes: script.estimatedMinutes,
          originalityScore: script.originalityScore,
          originalityReport: script.originalityReport,
          version: script.version,
          status: script.status,
          factCheckNotes: script.factCheckNotes,
        }
      : null,
    scenes: scenes.map((s) => ({
      id: s.id,
      index: s.order,
      title: s.title,
      description: s.description,
      durationMs: s.duration ? Math.round(s.duration * 1000) : null,
      durationSec: s.duration,
      visualType: s.visualType,
      visualNotes: s.visualNotes,
      narration: s.narrationText,
      transitionType: s.transitionType,
    })),
    idea: idea
      ? {
          id: idea.id,
          title: idea.title,
          description: idea.description,
          type: idea.type,
          status: idea.status,
          pillar: idea.pillar
            ? {
                id: idea.pillar.id,
                name: idea.pillar.name,
                color: idea.pillar.color,
                icon: idea.pillar.icon,
              }
            : null,
        }
      : null,
    claims: claims.map((c) => ({
      id: c.id,
      claim: c.claim,
      sourceIds: c.sourceIds,
      isConflicting: c.isConflicting,
      isUncertain: c.isUncertain,
      isRejected: c.isRejected,
      conflictNotes: c.conflictNotes,
      verified: !c.isUncertain && !c.isRejected && !c.isConflicting,
      createdAt: c.createdAt,
    })),
    review: review
      ? {
          id: review.id,
          factCheckPassed: review.factCheckPassed,
          originalityPassed: review.originalityPassed,
          copyrightPassed: review.copyrightPassed,
          advertiserFriendly: review.advertiserFriendly,
          aiDisclosureSet: review.aiDisclosureSet,
          thumbnailAccurate: review.thumbnailAccurate,
          titleAccurate: review.titleAccurate,
          audioQualityOk: review.audioQualityOk,
          videoQualityOk: review.videoQualityOk,
          captionsAccurate: review.captionsAccurate,
          noDeceptiveContent: review.noDeceptiveContent,
          overallPassed: review.overallPassed,
          issues: review.issues,
          reviewedAt: review.reviewedAt,
        }
      : null,
  })
}
