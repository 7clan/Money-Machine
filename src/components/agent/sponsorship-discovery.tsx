'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Megaphone,
  DollarSign,
  ExternalLink,
  Shield,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Handshake,
  Link2,
  Search,
  Filter,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export type SponsorshipStatus =
  | 'outreach'
  | 'negotiating'
  | 'agreed'
  | 'active'
  | 'rejected'

export type AffiliateStatus =
  | 'eligible'
  | 'applied'
  | 'approved'
  | 'active'
  | 'rejected'

export interface Sponsorship {
  id: string
  brandName: string
  industry: string
  estimatedCompensationMin: number
  estimatedCompensationMax: number
  deliverables: string[]
  riskLevel: RiskLevel
  status: SponsorshipStatus
  logoUrl?: string | null
}

export interface AffiliateProgram {
  id: string
  programName: string
  provider: string
  commissionRate: string
  cookieDuration: string
  eligibility: string
  status: AffiliateStatus
  url?: string | null
}

export interface SponsorshipDiscoveryProps {
  sponsorships?: Sponsorship[]
  affiliates?: AffiliateProgram[]
  onDiscover?: () => void
  className?: string
}

// ─── Constants ───────────────────────────────────────────────────────

const SPONSORSHIP_STATUS_STEPS: SponsorshipStatus[] = [
  'outreach',
  'negotiating',
  'agreed',
  'active',
]

const SPONSORSHIP_STATUS_LABELS: Record<SponsorshipStatus, string> = {
  outreach: 'Outreach',
  negotiating: 'Negotiating',
  agreed: 'Agreed',
  active: 'Active',
  rejected: 'Rejected',
}

const AFFILIATE_STATUS_LABELS: Record<AffiliateStatus, string> = {
  eligible: 'Eligible',
  applied: 'Applied',
  approved: 'Approved',
  active: 'Active',
  rejected: 'Rejected',
}

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; icon: React.ReactNode }> = {
  low: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    icon: <CheckCircle2 className="size-3.5" />,
  },
  medium: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    icon: <AlertTriangle className="size-3.5" />,
  },
  high: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    icon: <AlertTriangle className="size-3.5" />,
  },
}

const SPONSORSHIP_STATUS_COLORS: Record<SponsorshipStatus, string> = {
  outreach: 'bg-slate-500/15 text-slate-400',
  negotiating: 'bg-amber-500/15 text-amber-400',
  agreed: 'bg-sky-500/15 text-sky-400',
  active: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
}

const AFFILIATE_STATUS_COLORS: Record<AffiliateStatus, string> = {
  eligible: 'bg-slate-500/15 text-slate-400',
  applied: 'bg-amber-500/15 text-amber-400',
  approved: 'bg-sky-500/15 text-sky-400',
  active: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
}

// ─── Mock Data ───────────────────────────────────────────────────────

const MOCK_SPONSORSHIPS: Sponsorship[] = [
  {
    id: 'sp-1',
    brandName: 'Runway ML',
    industry: 'AI / Video Generation',
    estimatedCompensationMin: 2500,
    estimatedCompensationMax: 5000,
    deliverables: ['1 dedicated video', '2 story mentions', 'CTA link in description'],
    riskLevel: 'low',
    status: 'negotiating',
  },
  {
    id: 'sp-2',
    brandName: 'Vast.ai',
    industry: 'GPU Cloud Computing',
    estimatedCompensationMin: 1500,
    estimatedCompensationMax: 3000,
    deliverables: ['1 integrated review', 'affiliate link + promo code'],
    riskLevel: 'medium',
    status: 'outreach',
  },
  {
    id: 'sp-3',
    brandName: 'ElevenLabs',
    industry: 'AI Voice / TTS',
    estimatedCompensationMin: 3000,
    estimatedCompensationMax: 7500,
    deliverables: ['1 dedicated video', '3 short clips', 'blog cross-post'],
    riskLevel: 'low',
    status: 'active',
  },
]

const MOCK_AFFILIATES: AffiliateProgram[] = [
  {
    id: 'af-1',
    programName: 'Amazon Associates',
    provider: 'Amazon',
    commissionRate: '1–4%',
    cookieDuration: '24 hours',
    eligibility: 'Open enrollment',
    status: 'active',
  },
  {
    id: 'af-2',
    programName: 'Notion Affiliate',
    provider: 'Notion',
    commissionRate: '10%',
    cookieDuration: '30 days',
    eligibility: 'Apply with audience proof',
    status: 'approved',
  },
  {
    id: 'af-3',
    programName: 'NordVPN Affiliate',
    provider: 'Nord Security',
    commissionRate: '40% (one-time)',
    cookieDuration: '90 days',
    eligibility: 'Open enrollment',
    status: 'eligible',
  },
  {
    id: 'af-4',
    programName: 'Linear Affiliate',
    provider: 'Linear',
    commissionRate: '20%',
    cookieDuration: '60 days',
    eligibility: 'Invite only',
    status: 'applied',
  },
]

// ─── Sub-components ──────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = RISK_COLORS[level]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', cfg.bg, cfg.text)}>
      {cfg.icon}
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </span>
  )
}

function StatusSteps({ status }: { status: SponsorshipStatus }) {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-1 text-xs text-red-400">
        <AlertTriangle className="size-3.5" />
        Rejected
      </div>
    )
  }

  const currentIndex = SPONSORSHIP_STATUS_STEPS.indexOf(status)

  return (
    <div className="flex items-center gap-1">
      {SPONSORSHIP_STATUS_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIndex
        const isCurrent = idx === currentIndex
        return (
          <React.Fragment key={step}>
            {idx > 0 && (
              <div className={cn(
                'h-px w-3',
                isCompleted ? 'bg-emerald-500/60' : 'bg-slate-700/50'
              )} />
            )}
            <div className={cn(
              'flex items-center gap-1 text-[10px] font-medium',
              isCompleted ? 'text-emerald-400' : 'text-slate-500'
            )}>
              <div className={cn(
                'size-2 rounded-full',
                isCurrent ? 'bg-emerald-400 ring-2 ring-emerald-400/30' :
                isCompleted ? 'bg-emerald-500' : 'bg-slate-600'
              )} />
              <span className="hidden sm:inline">{SPONSORSHIP_STATUS_LABELS[step]}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

function SponsorshipCard({ data }: { data: Sponsorship }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group"
    >
      <Card className="bg-slate-900/80 border-slate-700/50 transition-colors duration-200 hover:border-slate-600/70">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-800/80">
                <Megaphone className="size-4 text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-sm text-slate-200">{data.brandName}</CardTitle>
                <CardDescription className="text-xs text-slate-400">{data.industry}</CardDescription>
              </div>
            </div>
            <RiskBadge level={data.riskLevel} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Compensation */}
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="size-4 text-emerald-400" />
              <span className="text-slate-300">
                ${data.estimatedCompensationMin.toLocaleString()} – ${data.estimatedCompensationMax.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">est. per deal</span>
            </div>

            {/* Deliverables */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-400">Deliverables</span>
              <ul className="space-y-0.5">
                {data.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                    <div className="size-1 rounded-full bg-violet-400/60 mt-1.5 shrink-0" />
                    <span className="min-w-0 break-words">{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Status Steps */}
            <div className="pt-1">
              <StatusSteps status={data.status} />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-600/50 text-slate-300 hover:text-slate-100 hover:border-slate-500/70 bg-transparent"
              >
                <ExternalLink className="size-3 mr-1" />
                Apply
              </Button>
              <Badge className={cn('text-[10px]', SPONSORSHIP_STATUS_COLORS[data.status])}>
                {SPONSORSHIP_STATUS_LABELS[data.status]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function AffiliateCard({ data }: { data: AffiliateProgram }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group"
    >
      <Card className="bg-slate-900/80 border-slate-700/50 transition-colors duration-200 hover:border-slate-600/70">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-800/80">
                <Link2 className="size-4 text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-sm text-slate-200">{data.programName}</CardTitle>
                <CardDescription className="text-xs text-slate-400">{data.provider}</CardDescription>
              </div>
            </div>
            <Badge className={cn('text-[10px]', AFFILIATE_STATUS_COLORS[data.status])}>
              {AFFILIATE_STATUS_LABELS[data.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2.5">
            {/* Commission & Cookie */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="size-3.5 text-emerald-400" />
                <div>
                  <div className="text-xs text-slate-500">Commission</div>
                  <div className="text-xs font-medium text-slate-300">{data.commissionRate}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-3.5 text-amber-400" />
                <div>
                  <div className="text-xs text-slate-500">Cookie</div>
                  <div className="text-xs font-medium text-slate-300">{data.cookieDuration}</div>
                </div>
              </div>
            </div>

            {/* Eligibility */}
            <div className="flex items-center gap-2 text-xs">
              <Shield className="size-3.5 text-sky-400" />
              <span className="text-slate-400">Eligibility:</span>
              <span className="text-slate-300">{data.eligibility}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-600/50 text-slate-300 hover:text-slate-100 hover:border-slate-500/70 bg-transparent"
              >
                <ExternalLink className="size-3 mr-1" />
                Apply
              </Button>
              {data.url && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-slate-400 hover:text-slate-200"
                >
                  <ExternalLink className="size-3 mr-1" />
                  Visit
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────

export function SponsorshipDiscovery({
  sponsorships,
  affiliates,
  onDiscover,
  className,
}: SponsorshipDiscoveryProps) {
  const allSponsorships = sponsorships ?? MOCK_SPONSORSHIPS
  const allAffiliates = affiliates ?? MOCK_AFFILIATES

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [riskFilter, setRiskFilter] = useState<string>('all')

  const filteredSponsorships = useMemo(() => {
    return allSponsorships.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (riskFilter !== 'all' && s.riskLevel !== riskFilter) return false
      return true
    })
  }, [allSponsorships, statusFilter, riskFilter])

  const filteredAffiliates = useMemo(() => {
    return allAffiliates.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      return true
    })
  }, [allAffiliates, statusFilter])

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10">
            <Handshake className="size-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-200">Sponsorship & Affiliate Discovery</h2>
            <p className="text-sm text-slate-400">Find partnership opportunities for your channel</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[130px] text-xs bg-slate-800/60 border-slate-700/50 text-slate-300">
              <Filter className="size-3.5 mr-1 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700/50">
              <SelectItem value="all" className="text-slate-300">All Statuses</SelectItem>
              <SelectItem value="outreach" className="text-slate-300">Outreach</SelectItem>
              <SelectItem value="negotiating" className="text-slate-300">Negotiating</SelectItem>
              <SelectItem value="agreed" className="text-slate-300">Agreed</SelectItem>
              <SelectItem value="active" className="text-slate-300">Active</SelectItem>
              <SelectItem value="rejected" className="text-slate-300">Rejected</SelectItem>
              <SelectItem value="eligible" className="text-slate-300">Eligible</SelectItem>
              <SelectItem value="applied" className="text-slate-300">Applied</SelectItem>
              <SelectItem value="approved" className="text-slate-300">Approved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs bg-slate-800/60 border-slate-700/50 text-slate-300">
              <Shield className="size-3.5 mr-1 text-slate-400" />
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700/50">
              <SelectItem value="all" className="text-slate-300">All Risks</SelectItem>
              <SelectItem value="low" className="text-slate-300">Low</SelectItem>
              <SelectItem value="medium" className="text-slate-300">Medium</SelectItem>
              <SelectItem value="high" className="text-slate-300">High</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={onDiscover}
            className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs"
          >
            <Search className="size-3.5" />
            Discover
          </Button>
        </div>
      </div>

      <Separator className="bg-slate-700/30" />

      {/* Sponsorship Opportunities */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="size-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-slate-200">Sponsorship Opportunities</h3>
          <Badge variant="secondary" className="text-[10px] bg-slate-800/60 text-slate-400 border-slate-700/40">
            {filteredSponsorships.length}
          </Badge>
        </div>

        <AnimatePresence mode="wait">
          {filteredSponsorships.length > 0 ? (
            <motion.div
              key="sponsor-list"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredSponsorships.map((s, idx) => (
                <motion.div key={s.id} variants={itemVariants}>
                  <SponsorshipCard data={s} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="sponsor-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 py-10 text-center"
            >
              <Users className="size-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">No sponsorships match your filters</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Affiliate Programs */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="size-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200">Affiliate Programs</h3>
          <Badge variant="secondary" className="text-[10px] bg-slate-800/60 text-slate-400 border-slate-700/40">
            {filteredAffiliates.length}
          </Badge>
        </div>

        <AnimatePresence mode="wait">
          {filteredAffiliates.length > 0 ? (
            <motion.div
              key="affiliate-list"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredAffiliates.map((a, idx) => (
                <motion.div key={a.id} variants={itemVariants}>
                  <AffiliateCard data={a} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="affiliate-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 py-10 text-center"
            >
              <Link2 className="size-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">No affiliate programs match your filters</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
