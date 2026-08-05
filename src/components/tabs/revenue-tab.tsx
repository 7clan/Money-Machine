'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard, DollarSign, TrendingUp, Rocket, Target,
  Sparkles, Award, Users, MessageSquare, Megaphone,
} from 'lucide-react'
import { YPPProgressTracker } from '@/components/agent/ypp-progress-tracker'
import { RevenueProjections } from '@/components/agent/revenue-projections'
import { RevenueProjectionCalculator } from '@/components/agent/revenue-projection-calculator'
import { RevenueForecastChart } from '@/components/agent/revenue-forecast-chart'
import { GlassCard } from '@/components/agent/glass-card'
import { fadeVariants, GradientCard, EmptyState } from './shared'
import type { AgentStatus, AnalyticsData } from './shared'

interface RevenueTabProps {
  status: AgentStatus | null
  analytics: AnalyticsData | null
}

export function RevenueTab({ status, analytics }: RevenueTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="revenue-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        {/* YPP Progress */}
        <GlassCard variant="gradient" glowFrom="from-amber-500" glowTo="to-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" /> YouTube Partner Program
            </CardTitle>
            <CardDescription className="text-[10px]">Track your path toward monetization eligibility</CardDescription>
          </CardHeader>
          <CardContent>
            <YPPProgressTracker
              subscribers={analytics?.totalSubscribers || 0}
              watchHours={analytics?.totalWatchTime || 0}
              publicUploads={status?.pipeline?.uploaded || 0}
              communityStrikes={0}
              twoStepVerified={false}
              adsenseLinked={false}
            />
          </CardContent>
        </GlassCard>

        {/* Revenue Projections */}
        <RevenueProjections
          totalViews={analytics?.totalViews || 0}
          totalSubscribers={analytics?.totalSubscribers || 0}
          estimatedRevenue={analytics?.estimatedRevenue || 0}
          videos={status?.pipeline?.uploaded || 0}
        />

        {/* Revenue Forecast Chart */}
        <RevenueForecastChart
          currentRpm={analytics?.estimatedRevenue && analytics?.totalViews ? (analytics.estimatedRevenue / analytics.totalViews) * 1000 : 0}
          currentViews={analytics?.totalViews || 0}
          growthRate={0.15}
        />

        {/* Revenue Goal Tracker */}
        <GradientCard glow="from-emerald-500/5 to-violet-500/5">
          <div className="p-4">
            <h3 className="text-sm font-semibold tracking-tight text-slate-200 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" /> Revenue Goals
            </h3>
            <div className="space-y-3">
              {[
                { label: 'First $1', current: analytics?.estimatedRevenue || 0, target: 1, icon: DollarSign, color: 'from-emerald-500 to-cyan-500' },
                { label: '$100/month', current: (analytics?.estimatedRevenue || 0) * 30, target: 100, icon: TrendingUp, color: 'from-violet-500 to-purple-500' },
                { label: '$1,000/month', current: (analytics?.estimatedRevenue || 0) * 30, target: 1000, icon: Rocket, color: 'from-amber-500 to-orange-500' },
              ].map((goal, i) => {
                const progress = Math.min(100, (goal.current / goal.target) * 100)
                const Icon = goal.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs text-slate-300 font-medium">{goal.label}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        ${goal.current.toFixed(2)} / ${goal.target}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ delay: i * 0.1 + 0.3, duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${goal.color}`}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </GradientCard>

        {/* Revenue Projection Calculator */}
        <RevenueProjectionCalculator
          currentRevenue={analytics?.estimatedRevenue || 0}
          currentViews={analytics?.totalViews || 0}
          currentSubscribers={analytics?.totalSubscribers || 0}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Revenue Tracking */}
          <GradientCard glow="from-emerald-500/5 to-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Revenue Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.estimatedRevenue ? (
                <div className="space-y-3">
                  <div className="text-3xl font-bold font-tabular-nums tracking-tight text-emerald-400">
                    ${(analytics.estimatedRevenue || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-400">Estimated lifetime revenue</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-slate-800/40">
                      <p className="text-[11px] text-slate-400">RPM</p>
                      <p className="text-sm font-mono text-slate-200">${(analytics.estimatedRevenue / Math.max(1, analytics.totalViews || 1) * 1000).toFixed(2)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/40">
                      <p className="text-[11px] text-slate-400">Total Views</p>
                      <p className="text-sm font-mono text-slate-200">{(analytics.totalViews || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState icon={DollarSign} title="No revenue data" desc="Connect YouTube and enable monetization to see revenue data." />
              )}
            </CardContent>
          </GradientCard>

          {/* Monetization Opportunities */}
          <GradientCard glow="from-violet-500/5 to-pink-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" /> Monetization Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'YouTube Partner Program', status: 'Thresholds not met', icon: Award, met: false },
                { label: 'Ad Revenue', status: 'Requires YPP', icon: DollarSign, met: false },
                { label: 'Channel Memberships', status: 'Requires 1K subscribers', icon: Users, met: false },
                { label: 'Super Chat', status: 'Requires YPP + livestream', icon: MessageSquare, met: false },
                { label: 'Merch Shelf', status: 'Requires 10K subscribers', icon: CreditCard, met: false },
                { label: 'Sponsorships', status: 'Available with audience', icon: Megaphone, met: false },
              ].map((opp, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-colors text-xs"
                >
                  <opp.icon className={`w-3.5 h-3.5 ${opp.met ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="text-slate-200 flex-1">{opp.label}</span>
                  <Badge variant="outline" className={`text-[10px] ${opp.met ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>
                    {opp.status}
                  </Badge>
                </motion.div>
              ))}
            </CardContent>
          </GradientCard>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
