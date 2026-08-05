import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** Approve a video project for upload */
export async function POST(request: NextRequest) {
  try {
    const { id, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const project = await db.videoProject.findUnique({ where: { id } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    if (project.status !== 'approved' && project.status !== 'review' && project.status !== 'failed') {
      return NextResponse.json({ error: `Cannot approve project in "${project.status}" status. Must be in review, approved, or failed.` }, { status: 400 })
    }

    const updated = await db.videoProject.update({
      where: { id },
      data: {
        status: 'approved',
        isApproved: true,
        editorNotes: notes || project.editorNotes,
      },
    })

    // Log the approval
    await db.auditLog.create({
      data: {
        action: 'metadata_update',
        actor: 'owner',
        target: id,
        details: JSON.stringify({ message: 'Video approved for upload', title: project.title }),
      },
    })

    // Persist notification
    await db.notification.create({
      data: {
        type: 'success',
        category: 'pipeline',
        title: 'Video approved',
        description: `"${project.title}" is now ready for upload to YouTube.`,
        isImportant: false,
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
