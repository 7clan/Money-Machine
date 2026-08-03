'use client'

import { motion } from 'framer-motion'
import {
  Users,
  Clock,
  Upload,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Lock,
  TrendingUp,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────

export interface YPPProgressTrackerProps {
  subscribers: number
  watchHours: number
  publicUploads: number
  communityStrikes: number
  twoStepVerified: boolean
  adsenseLinked: boolean
}

type MilestoneStatus = 'locked' | 'in-progress' | 'met'

interface Milestone {
  id: string
  icon: React.ElementType
  label: string
  current: number
  target: number
  unit: string
  status: MilestoneStatus
  percentage: number
}

// ─── Helpers ───────────────────────────────────────────────────────

function getMilestoneStatus(current: number, target: number): MilestoneStatus {
  if (current >= target) return 'met'
  if (current > 0) return 'in-progress'
  return 'locked'
}

function getPercentage(current: number, target: number): number {
  return Math.min(100, Math.round((current / target) * 100))
}

function estimateTimeToEligibility(
  current: number,
  target: number,
  growthRatePerMonth: number
): string | null {
  if (current >= target) return null
  if (growthRatePerMonth <= 0) return 'Unknown'
  const monthsRemaining = Math.ceil((target - current) / growthRatePerMonth)
  if (monthsRemaining <= 1) return '< 1 month'
  if (monthsRemaining <= 12) return `~${monthsRemaining} month${monthsRemaining > 1 ? 's' : ''}`
  const years = Math.floor(monthsRemaining / 12)
  const rem = monthsRemaining % 12
  return `~${years}y${rem > 0 ? ` ${rem}m` : ''}`
}

// ─── Animation Variants ────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
}

const progressVariants = {
  hidden: { scaleX: 0 },
  visible: (percentage: number) => ({
    scaleX: 1,
    transition: {
      duration: 0.8 + percentage * 0.005,
      ease: EASE_OUT,
    },
  }),
}

// ─── Status Badge ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: MilestoneStatus }) {
  const config = {
    met: { label: 'Met', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    'in-progress': { label: 'In Progress', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    locked: { label: 'Locked', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  }
  const c = config[status]
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', c.className)}>
      {c.label}
    </Badge>
  )
}

// ─── Milestone Card ────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  index,
  isLast,
}: {
  milestone: Milestone
  index: number
  isLast: boolean
}) {
  const Icon = milestone.icon
  const isMet = milestone.status === 'met'
  const isLocked = milestone.status === 'locked'

  return (
    <motion.div variants={itemVariants} className="relative flex gap-4">
      {/* Left: Icon + Connecting Line */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.15 + 0.3, type: 'spring', stiffness: 200, damping: 15 }}
          className={cn(
            'relative z-10 flex items-center justify-center w-11 h-11 rounded-xl border transition-colors',
            isMet
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : isLocked
                ? 'bg-slate-800/60 border-slate-700/40 text-slate-500'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
          )}
        >
          {isMet ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : isLocked ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
          {/* Pulse ring for in-progress */}
          {milestone.status === 'in-progress' && (
            <motion.div
              aria-hidden
              className="absolute inset-0 rounded-xl border-amber-500/30"
              animate={{ scale: [1, 1.15], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </motion.div>

        {/* Connecting line */}
        {!isLast && (
          <div
            className={cn(
              'w-0.5 flex-1 min-h-[48px] mt-2',
              isMet ? 'bg-emerald-500/40' : 'bg-slate-700/40'
            )}
          />
        )}
      </div>

      {/* Right: Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">{milestone.label}</span>
            <StatusBadge status={milestone.status} />
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            {milestone.current.toLocaleString()} / {milestone.target.toLocaleString()} {milestone.unit}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2.5 rounded-full bg-slate-800/60 overflow-hidden">
          <motion.div
            custom={milestone.percentage}
            variants={progressVariants}
            initial="hidden"
            animate="visible"
            className={cn(
              'absolute inset-y-0 left-0 rounded-full origin-left',
              isMet
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-amber-500 to-amber-400'
            )}
            style={{ width: `${milestone.percentage}%` }}
          />
          {/* Glow effect for in-progress */}
          {milestone.status === 'in-progress' && (
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-amber-400/30 blur-sm origin-left"
              animate={{ width: `${milestone.percentage}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          )}
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-slate-500">{milestone.percentage}% complete</span>
          {milestone.status === 'in-progress' && (
            <span className="text-[10px] text-amber-400/70">
              {milestone.target - milestone.current} more needed
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Additional Requirement Row ────────────────────────────────────

function RequirementRow({
  icon: Icon,
  label,
  met,
  detail,
}: {
  icon: React.ElementType
  label: string
  met: boolean
  detail?: string
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg border',
          met
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/15 border-red-500/30 text-red-400'
        )}
      >
        {met ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-200">{label}</span>
          <Badge
            variant="outline"
            className={cn(
              'text-[9px] px-1 py-0',
              met
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                : 'bg-red-500/15 text-red-300 border-red-500/25'
            )}
          >
            {met ? 'Pass' : 'Required'}
          </Badge>
        </div>
        {detail && <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────

export function YPPProgressTracker({
  subscribers,
  watchHours,
  publicUploads,
  communityStrikes,
  twoStepVerified,
  adsenseLinked,
}: YPPProgressTrackerProps) {
  // ── Build milestones ──
  const milestones: Milestone[] = [
    {
      id: 'subscribers',
      icon: Users,
      label: '1,000 Subscribers',
      current: subscribers,
      target: 1000,
      unit: 'subs',
      status: getMilestoneStatus(subscribers, 1000),
      percentage: getPercentage(subscribers, 1000),
    },
    {
      id: 'watch-hours',
      icon: Clock,
      label: '4,000 Watch Hours',
      current: watchHours,
      target: 4000,
      unit: 'hrs',
      status: getMilestoneStatus(watchHours, 4000),
      percentage: getPercentage(watchHours, 4000),
    },
    {
      id: 'public-uploads',
      icon: Upload,
      label: '3 Public Uploads (30d)',
      current: publicUploads,
      target: 3,
      unit: 'videos',
      status: getMilestoneStatus(publicUploads, 3),
      percentage: getPercentage(publicUploads, 3),
    },
  ]

  // ── Additional requirements ──
  const noStrikes = communityStrikes === 0
  const allAdditionalMet = noStrikes && twoStepVerified && adsenseLinked

  // ── Overall eligibility ──
  const milestoneScores = milestones.map((m) => m.percentage)
  const additionalScores = [noStrikes ? 100 : 0, twoStepVerified ? 100 : 0, adsenseLinked ? 100 : 0]
  const overallPercentage = Math.round(
    ([...milestoneScores, ...additionalScores].reduce((a, b) => a + b, 0)) /
    (milestoneScores.length + additionalScores.length)
  )

  const isFullyEligible = overallPercentage === 100

  // ── Estimated time projections (simple linear, assume ~5% monthly growth baseline) ──
  const subEstimate = estimateTimeToEligibility(subscribers, 1000, Math.max(1, subscribers * 0.05))
  const watchEstimate = estimateTimeToEligibility(watchHours, 4000, Math.max(1, watchHours * 0.05))
  const uploadEstimate = estimateTimeToEligibility(publicUploads, 3, 1)

  const estimates = [
    { label: 'Subscribers', estimate: subEstimate },
    { label: 'Watch Hours', estimate: watchEstimate },
    { label: 'Uploads', estimate: uploadEstimate },
  ].filter((e) => e.estimate !== null)

  // ── Find the longest estimate as the bottleneck ──
  const bottleneck = estimates.length > 0 ? estimates[estimates.length - 1] : null

  return (
    <Card className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              YPP Eligibility Tracker
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              YouTube Partner Program requirements
            </CardDescription>
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
            className={cn(
              'flex flex-col items-center px-4 py-2 rounded-xl border',
              isFullyEligible
                ? 'bg-emerald-500/15 border-emerald-500/30'
                : 'bg-amber-500/15 border-amber-500/30'
            )}
          >
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              Eligibility
            </span>
            <span
              className={cn(
                'text-2xl font-bold tabular-nums',
                isFullyEligible ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              {overallPercentage}%
            </span>
          </motion.div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Overall progress bar */}
        <div className="relative h-3 rounded-full bg-slate-800/60 overflow-hidden mb-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallPercentage}%` }}
            transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.3 }}
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              isFullyEligible
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400'
            )}
          />
          {overallPercentage > 0 && overallPercentage < 100 && (
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-white/10 blur-sm"
              animate={{ width: `${overallPercentage}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
          )}
        </div>

        {/* Milestone roadmap */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-0"
        >
          {milestones.map((milestone, i) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              index={i}
              isLast={i === milestones.length - 1}
            />
          ))}
        </motion.div>

        <Separator className="my-4 bg-slate-700/40" />

        {/* Additional requirements */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Additional Requirements
          </h4>

          <RequirementRow
            icon={AlertTriangle}
            label="No Community Strikes"
            met={noStrikes}
            detail={noStrikes ? 'Channel in good standing' : `${communityStrikes} active strike${communityStrikes > 1 ? 's' : ''}`}
          />
          <RequirementRow
            icon={Shield}
            label="2-Step Verification"
            met={twoStepVerified}
            detail={twoStepVerified ? 'Account secured' : 'Enable in Google Account settings'}
          />
          <RequirementRow
            icon={CheckCircle2}
            label="AdSense Linked"
            met={adsenseLinked}
            detail={adsenseLinked ? 'Monetization enabled' : 'Link an AdSense account to receive payments'}
          />
        </motion.div>

        {/* Estimated time to eligibility */}
        {!isFullyEligible && bottleneck && (
          <>
            <Separator className="my-4 bg-slate-700/40" />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30"
            >
              <TrendingUp className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-300">Estimated Time to Eligibility</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Based on current growth rate, the longest requirement is{' '}
                  <span className="text-amber-300 font-medium">{bottleneck.label}</span> at{' '}
                  <span className="text-amber-300 font-medium">{bottleneck.estimate}</span>.
                  {allAdditionalMet ? (
                    <span className="text-emerald-400/80"> All additional requirements are met.</span>
                  ) : (
                    <span className="text-red-400/80"> Some additional requirements still need attention.</span>
                  )}
                </p>
              </div>
            </motion.div>
          </>
        )}

        {/* Fully eligible banner */}
        {isFullyEligible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 150 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mt-4"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">Fully Eligible for YPP!</p>
              <p className="text-xs text-emerald-400/70 mt-0.5">
                All requirements are met. You can apply for the YouTube Partner Program.
              </p>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
