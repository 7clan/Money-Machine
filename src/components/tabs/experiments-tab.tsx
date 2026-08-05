'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ExperimentManager } from '@/components/agent/experiment-manager'
import { fadeVariants } from './shared'

interface ExperimentsTabProps {
  sendCommand: (command: string, extra?: any) => Promise<any>
}

export function ExperimentsTab({ sendCommand }: ExperimentsTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="experiments-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        <ExperimentManager
          onCreate={(exp) => sendCommand('create-experiment', { experiment: exp })}
          onCancel={(id) => sendCommand('cancel-experiment', { experimentId: id })}
        />
      </motion.div>
    </AnimatePresence>
  )
}
