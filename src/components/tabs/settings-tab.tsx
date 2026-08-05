'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ToggleLeft, Youtube, Loader2, AlertOctagon,
  CheckCircle2, Sparkles, Settings, Activity,
  Clock, RefreshCw, Brain, MonitorSmartphone,
} from 'lucide-react'
import { StorageDashboard } from '@/components/agent/storage-dashboard'
import { fadeVariants, GradientCard, MODES } from './shared'
import type { AgentStatus, ChannelData } from './shared'

interface SettingsTabProps {
  status: AgentStatus | null
  channel: ChannelData | null
  jobs: any[]
  sendCommand: (command: string, extra?: any) => Promise<any>
  connectYouTube: () => Promise<void>
  enableDemoMode: () => Promise<void>
  disconnectYouTube: () => Promise<void>
  ytConnecting: boolean
  ytDisconnecting: boolean
  ytDemoMode: boolean
  setYtWizardOpen: (open: boolean) => void
  pollAll: () => Promise<void>
}

export function SettingsTab({ status, channel, jobs, sendCommand, connectYouTube, enableDemoMode, disconnectYouTube, ytConnecting, ytDisconnecting, ytDemoMode, setYtWizardOpen, pollAll }: SettingsTabProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key="settings-content" variants={fadeVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
        {/* Operating Mode */}
        <GradientCard glow="from-violet-500/5 to-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ToggleLeft className="w-4 h-4 text-violet-400" /> Operating Mode
            </CardTitle>
            <CardDescription className="text-[10px]">Controls what actions the autonomous agent is permitted to perform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODES.map((mode) => {
                const Icon = mode.icon
                const isActive = status?.operatingMode === mode.key
                return (
                  <motion.button
                    key={mode.key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => sendCommand('set-mode', { mode: mode.key })}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                      isActive ? mode.activeColor + ' shadow-lg' : mode.color + ' bg-slate-800/40 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <p className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{mode.label}</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{mode.desc}</p>
                    {isActive && (
                      <Badge className={`mt-2 text-[10px] ${mode.badge}`}>Active</Badge>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </CardContent>
        </GradientCard>

        {/* YouTube Connection */}
        <GradientCard glow="from-red-500/5 to-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-400" /> YouTube Connection
            </CardTitle>
            <CardDescription className="text-[10px]">Google OAuth 2.0 is required for video uploads and analytics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${channel?.youtubeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    {channel?.youtubeConnected ? 'Connected' : 'Not Connected'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {channel?.youtubeConnected ? `Channel: ${channel.channel?.name || 'Unknown'}` : 'Click below to connect your YouTube account'}
                  </p>
                </div>
              </div>
              <Badge variant={channel?.youtubeConnected ? 'default' : 'outline'} className={`text-[10px] ${channel?.youtubeConnected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'border-red-500/30 text-red-300'}`}>
                {channel?.youtubeConnected ? 'Active' : 'Required'}
              </Badge>
            </div>

            {/* Connect / Disconnect Button */}
            {channel?.youtubeConnected ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">YouTube Connected Successfully</span>
                  </div>
                  <p className="text-[10px] text-emerald-300/80">
                    {ytDemoMode
                      ? 'Demo mode — uploads and analytics are simulated.'
                      : 'Videos can be uploaded, analytics will be collected, and autonomous publishing is available.'}
                  </p>
                </div>
                <Button
                  onClick={disconnectYouTube}
                  disabled={ytDisconnecting}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2"
                >
                  {ytDisconnecting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Disconnecting...</>
                  ) : (
                    <><AlertOctagon className="w-4 h-4" /> Disconnect YouTube</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/20 text-xs text-slate-300">
                  <p className="font-medium mb-1">Connect your YouTube channel to enable uploads & analytics</p>
                  <p className="text-[10px] text-slate-400">Use the setup wizard for step-by-step guidance, or try demo mode to explore.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setYtWizardOpen(true)}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-500/20 gap-1.5"
                  >
                    <Youtube className="w-3.5 h-3.5" /> Setup Wizard
                  </Button>
                  <Button
                    onClick={enableDemoMode}
                    disabled={ytConnecting}
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1.5"
                  >
                    {ytConnecting ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> Demo Mode</>
                    )}
                  </Button>
                </div>
                <Button
                  onClick={connectYouTube}
                  disabled={ytConnecting}
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-slate-200 gap-1.5 text-xs"
                >
                  {ytConnecting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Connecting...</>
                  ) : (
                    <><Youtube className="w-3 h-3" /> Already have credentials? Connect directly</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </GradientCard>

        {/* Storage Dashboard */}
        <StorageDashboard />

        {/* Agent Configuration */}
        <GradientCard glow="from-cyan-500/5 to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" /> Agent Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Poll Interval', value: '5s', icon: Clock },
                { label: 'Max Retries', value: '3', icon: RefreshCw },
                { label: 'AI Provider', value: 'Z.AI', icon: Brain },
                { label: 'Video Format', value: '1080p', icon: MonitorSmartphone },
              ].map((config, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
                  <config.icon className="w-4 h-4 mx-auto text-slate-400 mb-1.5" />
                  <p className="text-xs font-bold text-slate-200">{config.value}</p>
                  <p className="text-[11px] text-slate-400">{config.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </GradientCard>

        {/* Job Queue */}
        <GradientCard glow="from-amber-500/5 to-violet-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" /> Job Queue
              <Badge variant="outline" className="text-[10px] border-slate-600 ml-auto">{jobs.length} jobs</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {['pending', 'running', 'completed', 'failed'].map(s => (
                <div key={s} className="text-center p-2 rounded-lg bg-slate-800/30 border border-slate-700/20">
                  <p className="text-lg font-bold font-tabular-nums text-slate-200">{jobs.filter(j => j.status === s).length}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{s}</p>
                </div>
              ))}
            </div>
            <ScrollArea className="h-32">
              {jobs.length ? (
                <div className="space-y-1">
                  {jobs.slice(0, 10).map((job: any) => (
                    <div key={job.id} className="flex items-center gap-2 p-1.5 rounded bg-slate-800/30 text-[10px]">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${
                        job.status === 'completed' ? 'border-emerald-500/50 text-emerald-400' :
                        job.status === 'running' ? 'border-amber-500/50 text-amber-400' :
                        job.status === 'failed' ? 'border-red-500/50 text-red-400' :
                        'border-slate-600 text-slate-400'
                      }`}>{job.status}</Badge>
                      <span className="text-slate-300 truncate flex-1 font-mono">{job.type}</span>
                      <span className="text-slate-600 shrink-0">{new Date(job.scheduledAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">No jobs in queue</p>
              )}
            </ScrollArea>
          </CardContent>
        </GradientCard>

        {/* Danger Zone */}
        <GradientCard glow="from-red-500/5 to-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-300">
              <AlertOctagon className="w-4 h-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => sendCommand('stop')} disabled={!!status?.emergencyStop} variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200">
                <AlertOctagon className="w-3.5 h-3.5 mr-1.5" /> Emergency Stop
              </Button>
              <Button onClick={() => {
                fetch('/api/agent/reset', { method: 'POST' }).then(() => pollAll())
              }} variant="outline" size="sm" className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset Agent State
              </Button>
            </div>
          </CardContent>
        </GradientCard>
      </motion.div>
    </AnimatePresence>
  )
}
