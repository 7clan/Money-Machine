'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SponsorshipDiscovery } from '@/components/agent/sponsorship-discovery'
import { fadeVariants } from './shared'

interface OpportunitiesTabProps {
  sendCommand: (command: string, extra?: any) => Promise<any>
}

export function OpportunitiesTab({ sendCommand }: OpportunitiesTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="opportunities-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        <SponsorshipDiscovery
          onDiscover={() => sendCommand('discover-opportunities')}
        />
      </motion.div>
    </AnimatePresence>
  )
}
