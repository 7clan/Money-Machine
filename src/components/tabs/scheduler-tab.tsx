'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ContentScheduler } from '@/components/agent/content-scheduler'
import { GlassCard } from '@/components/agent/glass-card'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { CalendarClock } from 'lucide-react'
import { fadeVariants } from './shared'

interface SchedulerTabProps {
  schedulerIdeas: any[]
  handleScheduleIdea: (ideaId: string, dateISO: string, time: string) => Promise<void>
  handleUnscheduleIdea: (ideaId: string) => Promise<void>
}

export function SchedulerTab({ schedulerIdeas, handleScheduleIdea, handleUnscheduleIdea }: SchedulerTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="scheduler-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        <GlassCard variant="glow" glowFrom="from-cyan-500" glowTo="to-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-cyan-400" /> Content Scheduler
            </CardTitle>
            <CardDescription className="text-[10px]">Drag ideas onto the 14-day schedule, or use quick-schedule to assign a date and time</CardDescription>
          </CardHeader>
          <CardContent>
            <ContentScheduler
              ideas={schedulerIdeas}
              onSchedule={handleScheduleIdea}
              onUnschedule={handleUnscheduleIdea}
              onAutoFill={() => {
                const unscheduled = schedulerIdeas.filter(i => !i.scheduledDate)
                let dayOffset = 1
                unscheduled.slice(0, 7).forEach((idea) => {
                  const d = new Date()
                  d.setDate(d.getDate() + dayOffset)
                  dayOffset += 1
                  handleScheduleIdea(idea.id, d.toISOString().slice(0, 10), '09:00')
                })
              }}
              onClearSchedule={() => {
                schedulerIdeas.filter(i => i.scheduledDate).forEach((idea) => {
                  handleUnscheduleIdea(idea.id)
                })
              }}
            />
          </CardContent>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  )
}
