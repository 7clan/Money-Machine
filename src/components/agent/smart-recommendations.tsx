'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, Eye, Lightbulb, Youtube, Sparkles,
  Compass, Rocket, MonitorSmartphone, Search,
  TrendingUp, Settings, Wand2
} from 'lucide-react'
import { GlassCard } from '@/components/agent/glass-card'
import { Badge } from '@/components/ui/badge'

// ─── Types ─────────────────────────────────────────────────────────
interface SmartRecommendationsProps {
  agentState: string
  niche: string | null
  youtubeConnected: boolean
  pipeline: { ideas: number; approved: number; uploaded: number }
  onAction: (action: string) => void
}

interface Recommendation {
  id: string
  icon: typeof Play
  title: string
  description: string
  action: string
  priority: 'high' | 'medium' | 'low'
  accent: string
}

// ─── Smart Recommendations Panel ───────────────────────────────────
export function SmartRecommendations({
  agentState,
  niche,
  youtubeConnected,
  pipeline,
  onAction,
}: SmartRecommendationsProps) {
  const isActive = [
    'running', 'researching_niches', 'creating_strategy',
    'researching_topic', 'writing_script', 'producing_video',
    'reviewing', 'uploading', 'cycle_complete',
  ].includes(agentState)

  // Build contextual recommendations
  const recommendations: Recommendation[] = []

  // No YouTube connected — highest priority
  if (!youtubeConnected) {
    recommendations.push({
      id: 'connect-youtube',
      icon: Youtube,
      title: 'Connect YouTube Account',
      description: 'Link your YouTube channel to enable uploads and analytics tracking.',
      action: 'connect-youtube',
      priority: 'high',
      accent: 'text-red-400',
    })
  }

  // No niche selected
  if (!niche) {
    recommendations.push({
      id: 'select-niche',
      icon: Compass,
      title: 'Select a Niche First',
      description: 'Choose a content niche to generate targeted video ideas and strategy.',
      action: 'niche-research',
      priority: 'high',
      accent: 'text-violet-400',
    })
  }

  // Pipeline is empty — generate ideas
  if (pipeline.ideas === 0 && niche) {
    recommendations.push({
      id: 'generate-ideas',
      icon: Lightbulb,
      title: 'Generate Video Ideas',
      description: 'Run niche research to populate your content pipeline with ideas.',
      action: 'niche-research',
      priority: 'high',
      accent: 'text-amber-400',
    })
  }

  // Agent idle — suggest starting
  if (agentState === 'idle' && niche) {
    recommendations.push({
      id: 'start-agent',
      icon: Play,
      title: 'Start Agent',
      description: 'Begin the autonomous content production cycle.',
      action: 'initial-setup',
      priority: 'high',
      accent: 'text-emerald-400',
    })
    recommendations.push({
      id: 'run-niche-research',
      icon: Search,
      title: 'Run Niche Research',
      description: 'Deep-dive into your niche for fresh content opportunities.',
      action: 'niche-research',
      priority: 'medium',
      accent: 'text-cyan-400',
    })
  }

  // Agent running — monitor/pause
  if (isActive) {
    recommendations.push({
      id: 'monitor-progress',
      icon: Eye,
      title: 'Monitor Progress',
      description: 'Watch the current production cycle in real-time.',
      action: 'monitor',
      priority: 'medium',
      accent: 'text-emerald-400',
    })
    recommendations.push({
      id: 'pause-review',
      icon: Pause,
      title: 'Pause for Review',
      description: 'Temporarily halt the agent to review current output.',
      action: 'pause',
      priority: 'low',
      accent: 'text-amber-400',
    })
  }

  // Has approved but not uploaded
  if (pipeline.approved > 0 && pipeline.uploaded < pipeline.approved) {
    recommendations.push({
      id: 'upload-approved',
      icon: Rocket,
      title: 'Upload Approved Videos',
      description: `${pipeline.approved - pipeline.uploaded} approved video(s) ready to upload.`,
      action: 'upload',
      priority: 'medium',
      accent: 'text-cyan-400',
    })
  }

  // Has ideas but none approved — produce next
  if (pipeline.ideas > 0 && pipeline.approved === 0 && !isActive) {
    recommendations.push({
      id: 'produce-next',
      icon: Wand2,
      title: 'Produce Next Video',
      description: 'Move the next idea through the production pipeline.',
      action: 'produce-next',
      priority: 'medium',
      accent: 'text-emerald-400',
    })
  }

  // Always show strategy review if niche is set
  if (niche && recommendations.length < 4) {
    recommendations.push({
      id: 'review-strategy',
      icon: TrendingUp,
      title: 'Review Strategy',
      description: 'Analyze your content pillars and optimization opportunities.',
      action: 'strategy-review',
      priority: 'low',
      accent: 'text-violet-400',
    })
  }

  // Cap at 4 recommendations
  const visibleRecommendations = recommendations.slice(0, 4)

  const priorityBadge = (p: string) => {
    if (p === 'high') return <Badge className="text-[9px] h-4 bg-red-500/20 text-red-300 border-red-500/30">Priority</Badge>
    if (p === 'medium') return <Badge variant="outline" className="text-[9px] h-4 border-amber-500/30 text-amber-300">Suggested</Badge>
    return null
  }

  return (
    <GlassCard variant="default" className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-slate-200">Smart Recommendations</h3>
        <Badge variant="outline" className="text-[9px] h-4 border-slate-600 text-slate-400">
          {visibleRecommendations.length} tips
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <AnimatePresence>
          {visibleRecommendations.map((rec, i) => {
            const Icon = rec.icon
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
              >
                <button
                  onClick={() => onAction(rec.action)}
                  className="w-full text-left group rounded-lg border border-slate-800/60 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-700/60 p-3 transition-all duration-200"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5">
                      <div className={`p-1.5 rounded-md bg-slate-800/80 group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className={`w-3.5 h-3.5 ${rec.accent}`} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors truncate">
                          {rec.title}
                        </span>
                        {priorityBadge(rec.priority)}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                        {rec.description}
                      </p>
                    </div>
                  </div>
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </GlassCard>
  )
}
