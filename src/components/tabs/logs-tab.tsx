'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FileText, AlertTriangle, Activity } from 'lucide-react'
import { fadeVariants, StatusCard, GradientCard, EmptyState, actionColor, actionLabel } from './shared'

interface LogsTabProps {
  logs: any[]
}

export function LogsTab({ logs }: LogsTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="logs-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatusCard icon={FileText} label="Total Logs" value={logs.length} color="text-slate-400" />
          <StatusCard icon={AlertTriangle} label="Errors" value={logs.filter((l: any) => l.action === 'emergency_stop').length} color="text-red-400" />
          <StatusCard icon={Activity} label="Today" value={logs.filter((l: any) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length} color="text-emerald-400" trend="up" />
        </div>
        <GradientCard glow="from-slate-500/5 to-violet-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Audit Trail</CardTitle><CardDescription className="text-[10px]">Complete log of all agent actions and system events</CardDescription></CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {logs.length ? (
                <div className="space-y-1">
                  {logs.map((log: any, i: number) => (
                    <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/30 transition-colors text-xs border-b border-slate-800/30">
                      <span className="text-slate-600 font-mono text-[10px] w-20 shrink-0">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <Badge variant="outline" className={`text-[10px] h-4 shrink-0 ${actionColor(log.action)}`}>{actionLabel(log.action)}</Badge>
                      <span className="text-slate-500 text-[10px] w-14 shrink-0">{log.actor}</span>
                      <span className="text-slate-300 truncate flex-1 font-mono text-[10px]">{(() => { try { const d = JSON.parse(log.details || '{}'); return d.message || d.detail || log.details } catch { return log.details } })()}</span>
                      {log.target && (<span className="text-slate-500 text-[10px] shrink-0 font-mono">{log.target}</span>)}
                    </motion.div>
                  ))}
                </div>
              ) : (<EmptyState icon={FileText} title="No logs" desc="Agent activity will be logged here." />)}
            </ScrollArea>
          </CardContent>
        </GradientCard>
      </motion.div>
    </AnimatePresence>
  )
}
