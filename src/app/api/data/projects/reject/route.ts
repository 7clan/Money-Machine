import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Reject a video project (send back for revision) */
export async function POST(request: NextRequest) {
  try {
    const { id, reason } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const project = await db.videoProject.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    if (project.status === 'uploaded' || project.status === 'uploading') {
      return NextResponse.json({ error: 'Cannot reject an already-uploaded video' }, { status: 400 })
    }

    const updated = await db.videoProject.update({
      where: { id },
      data: {
        status: 'failed',
        isApproved: false,
        editorNotes: reason ? `REJECTED: ${reason}` : 'Rejected by operator',
      },
    })

    // Log the rejection
    await db.auditLog.create({
      data: {
        action: 'metadata_update',
        actor: 'owner',
        target: id,
        details: JSON.stringify({ message: 'Video rejected', reason: reason || 'No reason given', title: project.title }),
      },
    })

    // Persist notification
    await db.notification.create({
      data: {
        type: 'warning',
        category: 'pipeline',
        title: 'Video rejected',
        description: `"${project.title}" was sent back for revision. Reason: ${reason || 'not specified'}`,
        isImportant: true,
        targetId: id,
        targetType: 'video_project',
        actionLabel: 'View pipeline',
        actionTab: 'pipeline',
      },
    }).catch(() => {})

    return NextResponse.json({ ok: true, project: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
