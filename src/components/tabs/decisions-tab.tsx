'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { GitBranch, CheckCircle2, AlertTriangle, Zap } from 'lucide-react'
import { fadeVariants, StatusCard, GradientCard, EmptyState, actionColor, actionLabel } from './shared'

interface DecisionsTabProps {
  logs: any[]
}

export function DecisionsTab({ logs }: DecisionsTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="decisions-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatusCard icon={GitBranch} label="Total Decisions" value={logs.length} color="text-violet-400" hint="All agent decisions and actions" />
          <StatusCard icon={CheckCircle2} label="Successful" value={logs.filter((l: any) => l.action !== 'emergency_stop' && !(l.details || '').includes('error')).length} color="text-emerald-400" trend="up" />
          <StatusCard icon={AlertTriangle} label="Errors" value={logs.filter((l: any) => (l.details || '').includes('error') || (l.details || '').includes('fail')).length} color="text-red-400" />
          <StatusCard icon={Zap} label="Last Action" value={logs[0] ? new Date(logs[0].createdAt).toLocaleTimeString() : 'N/A'} color="text-amber-400" />
        </div>
        <GradientCard glow="from-violet-500/5 to-cyan-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4 text-violet-400" /> Decision Timeline</CardTitle><CardDescription className="text-[10px]">Complete history of agent decisions and actions</CardDescription></CardHeader>
          <CardContent>
            {logs.length ? (
              <ScrollArea className="h-96">
                <div className="relative">
                  <div className="absolute left-[19px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-violet-500/30 via-slate-700/30 to-transparent" />
                  <div className="space-y-3">
                    {logs.slice(0, 30).map((log: any, i: number) => {
                      const detail = (() => { try { return JSON.parse(log.details || '{}') } catch { return { message: log.details } } })()
                      return (
                        <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} className="flex items-start gap-3 pl-1">
                          <div className={`w-5 h-5 rounded-full border-2 border-slate-800 shrink-0 mt-0.5 flex items-center justify-center ${log.action === 'emergency_stop' ? 'bg-red-500 border-red-500/50' : log.action === 'upload' ? 'bg-cyan-500 border-cyan-500/50' : log.action === 'strategy_change' ? 'bg-violet-500 border-violet-500/50' : 'bg-slate-600 border-slate-600/50'}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] h-4 ${actionColor(log.action)}`}>{actionLabel(log.action)}</Badge>
                              <span className="text-[10px] text-slate-400 font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5 truncate">{detail.message || detail.detail || log.details || '—'}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </ScrollArea>
            ) : (<EmptyState icon={GitBranch} title="No decisions recorded" desc="Agent decisions will appear here as it operates." />)}
          </CardContent>
        </GradientCard>
      </motion.div>
    </AnimatePresence>
  )
}
