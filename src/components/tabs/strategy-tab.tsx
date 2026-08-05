'use client'

import React, { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Globe, Youtube, Target, Compass, Users, Calendar,
  Layers, Award, CheckCircle2, HeartPulse,
} from 'lucide-react'
import { HealthDiagnostics } from '@/components/agent/health-diagnostics'
import { GlassCard } from '@/components/agent/glass-card'
import { fadeVariants, GradientCard, EmptyState } from './shared'
import type { AgentStatus, ChannelData } from './shared'

interface StrategyTabProps {
  status: AgentStatus | null
  channel: ChannelData | null
}

export function StrategyTab({ status, channel }: StrategyTabProps) {
  const nicheBarData = useMemo(() => {
    if (!channel?.niches?.length) return []
    return channel.niches.slice(0, 10).map((n: any) => ({
      name: n.nicheName.length > 16 ? n.nicheName.slice(0, 16) + '…' : n.nicheName,
      score: n.compositeScore || 0,
      selected: n.isSelected,
    }))
  }, [channel])

  return (
    <AnimatePresence mode="wait">
      <motion.div key="strategy-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Channel Info */}
          <GradientCard glow="from-violet-500/5 to-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" /> Channel Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {channel?.channel ? (
                <>
                  {[
                    { label: 'Name', value: channel.channel.name, icon: Youtube },
                    { label: 'Niche', value: channel.channel.niche, icon: Target },
                    { label: 'Positioning', value: channel.channel.positioning, icon: Compass },
                    { label: 'Target Viewer', value: channel.channel.targetViewer, icon: Users },
                    { label: 'Upload Cadence', value: channel.channel.uploadCadence, icon: Calendar },
                  ].map((item, i) => item.value && (
                    <div key={i} className="flex items-start gap-2.5 text-xs">
                      <item.icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-slate-400">{item.label}:</span>
                        <span className="text-slate-200 ml-1.5">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState icon={Globe} title="Channel not configured" desc="Run initial setup to create your channel strategy." />
              )}
            </CardContent>
          </GradientCard>

          {/* Content Pillars */}
          <GradientCard glow="from-amber-500/5 to-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" /> Content Pillars
              </CardTitle>
            </CardHeader>
            <CardContent>
              {channel?.pillars?.length ? (
                <div className="space-y-2">
                  {channel.pillars.map((pillar: any, i: number) => (
                    <motion.div
                      key={pillar.id}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/40 border border-slate-700/30"
                    >
                      <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: pillar.color || '#6366f1' }} />
                      <div>
                        <p className="text-xs font-medium text-slate-200">{pillar.name}</p>
                        {pillar.description && <p className="text-[10px] text-slate-400 mt-0.5">{pillar.description}</p>}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Layers} title="No pillars defined" desc="Content pillars are created during initial setup." />
              )}
            </CardContent>
          </GradientCard>
        </div>

        {/* Niche Rankings */}
        <GradientCard glow="from-emerald-500/5 to-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" /> Niche Analysis
              <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{channel?.niches?.length || 0} niches scored</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channel?.niches?.length ? (
              <div className="space-y-3">
                {/* Bar chart */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nicheBarData} layout="vertical" margin={{ left: 24, right: 36, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11, fill: '#cbd5e1' }} />
                      <RechartsTooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={22}>
                        {nicheBarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.selected ? '#10b981' : '#8b5cf6'} fillOpacity={entry.selected ? 0.9 : 0.55} />
                        ))}
                        <LabelList
                          dataKey="score"
                          position="right"
                          formatter={(v: any) => (typeof v === 'number' ? v.toFixed(1) : v)}
                          style={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Selected niche highlight */}
                {channel.niches.find((n: any) => n.isSelected) && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-300">
                      Selected: <strong>{channel.niches.find((n: any) => n.isSelected).nicheName}</strong>
                      {' '}(Score: {channel.niches.find((n: any) => n.isSelected).compositeScore.toFixed(1)})
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState icon={Target} title="No niche analysis" desc="Run initial setup to research and score niches." />
            )}
          </CardContent>
        </GradientCard>

        {/* Niche Comparison Matrix */}
        <GradientCard glow="from-emerald-500/5 to-violet-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" /> Niche Comparison Matrix
            </CardTitle>
            <CardDescription className="text-[10px]">Multi-dimensional scoring across key criteria</CardDescription>
          </CardHeader>
          <CardContent>
            {channel?.niches?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left py-2 px-2 text-slate-400 font-medium">Niche</th>
                      {['Revenue', 'Audience', 'Competition', 'Evergreen', 'Production', 'Risk'].map(h => (
                        <th key={h} className="text-center py-2 px-1.5 text-slate-400 font-medium">{h}</th>
                      ))}
                      <th className="text-center py-2 px-2 text-slate-400 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channel.niches.slice(0, 8).map((n: any) => (
                      <tr key={n.id} className={`border-b border-slate-800/50 ${n.isSelected ? 'bg-emerald-500/5' : ''}`}>
                        <td className="py-1.5 px-2 text-slate-200 font-medium truncate max-w-[120px]">{n.nicheName}</td>
                        {[
                          { val: n.revenuePerHour, max: 50 },
                          { val: n.audienceSize, max: 10 },
                          { val: 10 - n.competition, max: 10 },
                          { val: n.evergreenPotential, max: 10 },
                          { val: 10 - n.productionDifficulty, max: 10 },
                          { val: 10 - n.copyrightRisk - n.misinformationRisk, max: 10 },
                        ].map(({ val, max }, ci) => {
                          const pct = Math.min(100, Math.max(0, ((val || 0) / max) * 100))
                          const color = pct > 70 ? 'bg-emerald-500' : pct > 40 ? 'bg-amber-500' : 'bg-red-500'
                          return (
                            <td key={ci} className="py-1.5 px-1.5">
                              <div className="flex items-center justify-center">
                                <div className="w-12 h-1.5 rounded-full bg-slate-800">
                                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </td>
                          )
                        })}
                        <td className="py-1.5 px-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${n.isSelected ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-600 text-slate-400'}`}>
                            {(n.compositeScore || 0).toFixed(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Compass} title="No niches to compare" desc="Run niche research to populate the comparison matrix." />
            )}
          </CardContent>
        </GradientCard>

        {/* Agent Health Diagnostics */}
        <GlassCard variant="gradient" glowFrom="from-cyan-500" glowTo="to-violet-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-cyan-400" /> Agent Health & Diagnostics
            </CardTitle>
            <CardDescription className="text-[10px]">System status, engine health, and runtime diagnostics</CardDescription>
          </CardHeader>
          <CardContent>
            <HealthDiagnostics
              agentState={status?.state || 'idle'}
              operatingMode={status?.operatingMode || 'simulation'}
              emergencyStop={status?.emergencyStop || false}
              lastAction={status?.lastAction || null}
              youtubeConnected={channel?.youtubeConnected || false}
              niche={status?.niche || null}
            />
          </CardContent>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  )
}
