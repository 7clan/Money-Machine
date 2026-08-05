'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ContentCalendar } from '@/components/agent/content-calendar'
import { GlassCard } from '@/components/agent/glass-card'
import { CardContent } from '@/components/ui/card'
import { CalendarDays } from 'lucide-react'
import { fadeVariants, EmptyState } from './shared'
import type { PipelineData } from './shared'

interface CalendarTabProps {
  pipeline: PipelineData | null
  setActiveTab: (tab: string) => void
}

export function CalendarTab({ pipeline, setActiveTab }: CalendarTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="calendar-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        {pipeline?.ideas?.length || pipeline?.uploads?.length ? (
          <ContentCalendar
            ideas={pipeline?.ideas || []}
            uploads={pipeline?.uploads || []}
            className="border-0 bg-transparent shadow-none"
          />
        ) : (
          <GlassCard variant="glow" glowFrom="from-violet-500" glowTo="to-cyan-500">
            <CardContent className="py-10">
              <EmptyState icon={CalendarDays} title="No calendar data" desc="Produce or schedule videos to populate the calendar." accent="amber" action={{ label: 'Schedule Video', onClick: () => setActiveTab('scheduler') }} />
            </CardContent>
          </GlassCard>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
