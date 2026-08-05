'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Flame, Lightbulb, Film, CloudUpload, ShieldCheck } from 'lucide-react'
import { PipelineProgress } from '@/components/agent/pipeline-progress'
import { IdeaExplorer } from '@/components/agent/idea-explorer'
import { VideoProjectExplorer } from '@/components/agent/video-project-explorer'
import { QualityReviewPanel } from '@/components/agent/quality-review-panel'
import { GlassCard } from '@/components/agent/glass-card'
import { IdeaListSkeleton } from '@/components/agent/skeletons'
import { fadeVariants, GradientCard, PipelineFlow, EmptyState } from './shared'
import type { AgentStatus, PipelineData } from './shared'

interface PipelineTabProps {
  status: AgentStatus | null
  pipeline: PipelineData | null
  initialLoaded: boolean
  sendCommand: (command: string, extra?: any) => Promise<any>
  setActiveTab: (tab: string) => void
  pollAll: () => Promise<void>
  toast: any
  setPreviewVideoId: (id: string | null) => void
}

export function PipelineTab({ status, pipeline, initialLoaded, sendCommand, setActiveTab, pollAll, toast, setPreviewVideoId }: PipelineTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="pipeline-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        {/* Pipeline Progress — Funnel bar + Stage detail cards + Quick actions */}
        <PipelineProgress
          pipelineCounts={{
            ideas: status?.pipeline?.ideas || 0,
            researched: status?.pipeline?.researched || 0,
            scripted: status?.pipeline?.scripted || 0,
            producing: status?.pipeline?.producing || 0,
            reviewing: status?.pipeline?.reviewing || 0,
            uploaded: status?.pipeline?.uploaded || 0,
          }}
          onAction={(stageKey) => {
            const commandMap: Record<string, string> = {
              ideas: 'niche-research',
              researched: 'research',
              scripted: 'write-script',
              producing: 'produce',
              reviewing: 'review',
              uploaded: 'upload',
            }
            sendCommand(commandMap[stageKey] || stageKey)
          }}
        />

        {/* Pipeline Flow (large) with stage progress */}
        <GradientCard glow="from-violet-500/5 to-cyan-500/5">
          <div className="p-4">
            <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" /> Content Pipeline Flow
            </h3>
            <PipelineFlow pipeline={status?.pipeline || null} />
          </div>
        </GradientCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Video Ideas — Enhanced with search / filter / detail drawer */}
          <GlassCard variant="gradient" glowFrom="from-violet-500" glowTo="to-cyan-500" className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-violet-400" /> Video Ideas
                <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.ideas?.length || 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pipeline?.ideas?.length ? (
                <IdeaExplorer
                  ideas={pipeline.ideas}
                  onSelectIdea={() => setActiveTab('pipeline')}
                  onBulkAction={() => {
                    pollAll()
                    toast({ type: 'success', title: 'Bulk action complete', description: 'Pipeline refreshed', duration: 2500 })
                  }}
                />
              ) : initialLoaded ? (
                <EmptyState icon={Lightbulb} title="No ideas yet" desc="Run initial setup to generate video ideas from your niche." accent="violet" action={{ label: 'Generate Ideas', onClick: () => sendCommand('niche-research') }} />
              ) : (
                <IdeaListSkeleton count={5} />
              )}
            </CardContent>
          </GlassCard>

          {/* Video Projects — Clickable to open preview modal */}
          <GlassCard variant="gradient" glowFrom="from-emerald-500" glowTo="to-cyan-500" className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Film className="w-4 h-4 text-emerald-400" /> Video Projects
                <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.projects?.length || 0}</Badge>
              </CardTitle>
              <CardDescription className="text-[10px]">Click any project to preview video, script, scenes &amp; review. Use Select mode for bulk actions.</CardDescription>
            </CardHeader>
            <CardContent>
              {pipeline?.projects?.length ? (
                <VideoProjectExplorer
                  projects={pipeline.projects}
                  onPreview={(id) => setPreviewVideoId(id)}
                  onBulkAction={() => {
                    pollAll()
                    toast({ type: 'success', title: 'Bulk action complete', description: 'Pipeline refreshed', duration: 2500 })
                  }}
                />
              ) : initialLoaded ? (
                <EmptyState icon={Film} title="No projects yet" desc="Produce a video to see it appear here." accent="emerald" action={{ label: 'Produce Video', onClick: () => sendCommand('produce') }} />
              ) : (
                <IdeaListSkeleton count={3} />
              )}
            </CardContent>
          </GlassCard>
        </div>

        {/* Uploads */}
        <GradientCard>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-cyan-400" /> Uploads
              <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.uploads?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-40">
              {pipeline?.uploads?.length ? (
                <div className="space-y-1">
                  {pipeline.uploads.map((upload: any) => (
                    <div key={upload.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/30 text-xs">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${upload.uploadStatus === 'completed' ? 'border-emerald-500/50 text-emerald-400' : 'border-red-500/50 text-red-400'}`}>
                        {upload.uploadStatus}
                      </Badge>
                      <span className="text-slate-300 truncate flex-1">{upload.title}</span>
                      {upload.youtubeVideoId && (
                        <span className="text-[10px] text-slate-400 font-mono">{upload.youtubeVideoId}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] border-slate-600 shrink-0">{upload.privacy}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={CloudUpload} title="No uploads yet" desc="Videos will appear here after YouTube upload." accent="cyan" action={{ label: 'Upload Video', onClick: () => toast({ type: 'info', title: 'YouTube not connected', description: 'Connect your YouTube account to upload videos.', duration: 3000 }) }} />
              )}
            </ScrollArea>
          </CardContent>
        </GradientCard>

        {/* Quality Review Panel */}
        <GlassCard variant="glow" glowFrom="from-rose-500" glowTo="to-violet-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" /> Quality Review History
              <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{pipeline?.reviews?.length || 0}</Badge>
            </CardTitle>
            <CardDescription className="text-[10px]">Fact-check, originality, copyright & policy compliance for every produced video</CardDescription>
          </CardHeader>
          <CardContent>
            {pipeline?.reviews?.length || pipeline?.projects?.length ? (
              <QualityReviewPanel
                reviews={pipeline?.reviews || []}
                projects={pipeline?.projects || []}
              />
            ) : initialLoaded ? (
              <EmptyState icon={ShieldCheck} title="No quality reviews yet" desc="Produce a video to trigger automated review." accent="rose" action={{ label: 'Produce Video', onClick: () => sendCommand('produce') }} />
            ) : (
              <IdeaListSkeleton count={3} />
            )}
          </CardContent>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  )
}
