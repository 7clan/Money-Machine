'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Play, Pause, Square, AlertTriangle, Activity, Video,
  TrendingUp, DollarSign, Eye, Clock, CheckCircle2,
  XCircle, Loader2, Youtube, Shield, Brain, Zap,
  FileText, Upload, BarChart3, Settings, AlertOctagon
} from 'lucide-react'

// Types
interface AgentStatus {
  state: string
  currentJob: string | null
  operatingMode: string
  emergencyStop: boolean
  niche: string | null
  channelName: string | null
  pipeline: { ideas: number; researched: number; scripted: number; producing: number; reviewing: number; approved: number; uploaded: number }
  lastAction: string | null
  lastError: string | null
  nextAction: string | null
}

interface PipelineData {
  ideas: any[]
  projects: any[]
  uploads: any[]
  scripts: any[]
  reviews: any[]
}

interface ChannelData {
  channel: any
  youtubeConnected: boolean
  niches: any[]
  pillars: any[]
}

export default function Dashboard() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [pipeline, setPipeline] = useState<PipelineData | null>(null)
  const [channel, setChannel] = useState<ChannelData | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Poll for status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/status')
      if (res.ok) setStatus(await res.json())
    } catch {}
  }, [])

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch('/api/data/pipeline')
      if (res.ok) setPipeline(await res.json())
    } catch {}
  }, [])

  const fetchChannel = useCallback(async () => {
    try {
      const res = await fetch('/api/data/channel')
      if (res.ok) setChannel(await res.json())
    } catch {}
  }, [])

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/data/jobs')
      if (res.ok) setJobs(await res.json())
    } catch {}
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/data/audit-logs')
      if (res.ok) setLogs(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchPipeline()
    fetchChannel()
    fetchJobs()
    fetchLogs()
    const interval = setInterval(() => {
      fetchStatus()
      fetchPipeline()
      fetchJobs()
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchPipeline, fetchChannel, fetchJobs])

  const sendCommand = async (command: string, extra?: any) => {
    setLoading(true)
    try {
      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...extra }),
      })
      const data = await res.json()
      await fetchStatus()
      return data
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const stateColor = (state: string) => {
    switch (state) {
      case 'running': case 'researching_niches': case 'creating_strategy': case 'researching_topic': case 'writing_script': case 'producing_video': case 'reviewing': case 'uploading': case 'cycle_complete': return 'bg-emerald-500'
      case 'error': return 'bg-red-500'
      case 'paused': return 'bg-amber-500'
      case 'idle': case 'ready': return 'bg-slate-400'
      default: return 'bg-slate-400'
    }
  }

  const modeLabel = (mode: string) => {
    switch (mode) {
      case 'simulation': return 'Simulation'
      case 'private_production': return 'Private Production'
      case 'autonomous_publication': return 'Autonomous Publication'
      default: return mode
    }
  }

  const totalPipeline = status ? Object.values(status.pipeline).reduce((a, b) => a + b, 0) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Youtube className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">YouTube Revenue Studio</h1>
            <p className="text-xs text-slate-400">Autonomous Content Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Emergency Stop */}
          <Button
            variant={status?.emergencyStop ? 'outline' : 'destructive'}
            size="sm"
            onClick={() => sendCommand(status?.emergencyStop ? 'resume' : 'stop')}
            className={status?.emergencyStop ? 'border-red-500 text-red-400' : ''}
          >
            {status?.emergencyStop ? (
              <><AlertOctagon className="w-4 h-4 mr-1" /> STOPPED - Click to Resume</>
            ) : (
              <><Square className="w-4 h-4 mr-1" /> Emergency Stop</>
            )}
          </Button>
          
          {/* Mode indicator */}
          <Badge variant="outline" className="text-xs border-slate-600">
            {modeLabel(status?.operatingMode || 'private_production')}
          </Badge>

          {/* Connection status */}
          <Badge variant={channel?.youtubeConnected ? 'default' : 'secondary'} className="text-xs">
            <Youtube className="w-3 h-3 mr-1" />
            {channel?.youtubeConnected ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="mb-4 bg-slate-900">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
              <Activity className="w-4 h-4 mr-1" /> Overview
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="data-[state=active]:bg-slate-700">
              <Video className="w-4 h-4 mr-1" /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="strategy" className="data-[state=active]:bg-slate-700">
              <Brain className="w-4 h-4 mr-1" /> Strategy
            </TabsTrigger>
            <TabsTrigger value="jobs" className="data-[state=active]:bg-slate-700">
              <Clock className="w-4 h-4 mr-1" /> Jobs
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-700">
              <FileText className="w-4 h-4 mr-1" /> Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-slate-700">
              <Settings className="w-4 h-4 mr-1" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4">
            {/* Agent State Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardDescription>Agent State</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stateColor(status?.state || 'idle')} ${status?.state === 'running' ? 'animate-pulse' : ''}`} />
                    <span className="text-xl font-bold capitalize">{status?.state?.replace(/_/g, ' ') || 'Idle'}</span>
                  </div>
                  {status?.currentJob && (
                    <p className="text-sm text-slate-400 mt-1">Working: {status.currentJob}</p>
                  )}
                  {status?.nextAction && (
                    <p className="text-sm text-emerald-400 mt-1">Next: {status.nextAction}</p>
                  )}
                  {status?.lastError && (
                    <p className="text-sm text-red-400 mt-1">Error: {status.lastError}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardDescription>Channel</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{status?.channelName || 'Not set'}</p>
                  <p className="text-sm text-slate-400 mt-1">Niche: {status?.niche || 'Not selected'}</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardDescription>Production Pipeline</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {status && Object.entries(status.pipeline).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-slate-400 capitalize">{key}</span>
                        <span className="font-mono">{val}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardDescription>Controls</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => sendCommand('full-cycle')} disabled={loading || status?.emergencyStop} className="bg-emerald-600 hover:bg-emerald-700">
                  {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
                  Start Full Cycle
                </Button>
                <Button onClick={() => sendCommand('initial-setup')} disabled={loading || status?.emergencyStop} variant="secondary">
                  <Brain className="w-4 h-4 mr-1" /> Run Setup
                </Button>
                <Button onClick={() => sendCommand('produce-next')} disabled={loading || status?.emergencyStop} variant="secondary">
                  <Video className="w-4 h-4 mr-1" /> Produce Next
                </Button>
                <Button onClick={() => sendCommand('pause')} disabled={loading} variant="outline">
                  <Pause className="w-4 h-4 mr-1" /> Pause
                </Button>
                <Button onClick={() => sendCommand('resume')} disabled={loading} variant="outline">
                  <Play className="w-4 h-4 mr-1" /> Resume
                </Button>
                <Button onClick={() => sendCommand('process-job')} disabled={loading} variant="outline">
                  <Activity className="w-4 h-4 mr-1" /> Process Job
                </Button>
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardDescription>Recent Activity</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  {logs.length === 0 ? (
                    <p className="text-sm text-slate-500">No activity yet</p>
                  ) : (
                    <div className="space-y-1">
                      {logs.slice(0, 20).map((log: any) => (
                        <div key={log.id} className="flex gap-2 text-sm">
                          <span className="text-slate-500 font-mono text-xs">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-xs h-5 border-slate-700">{log.action}</Badge>
                          <span className="text-slate-300 truncate">{log.details}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PIPELINE TAB */}
          <TabsContent value="pipeline" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Video Ideas */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Video Ideas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <div className="space-y-2">
                      {pipeline?.ideas?.map((idea: any) => (
                        <div key={idea.id} className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                          <Badge variant="outline" className={`text-xs ${idea.type === 'short' ? 'border-purple-500 text-purple-400' : 'border-cyan-500 text-cyan-400'}`}>
                            {idea.type === 'short' ? 'Short' : 'Long'}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${idea.status === 'uploaded' ? 'border-emerald-500 text-emerald-400' : idea.status === 'idea' ? 'border-slate-500 text-slate-400' : 'border-amber-500 text-amber-400'}`}>
                            {idea.status}
                          </Badge>
                          <span className="text-sm truncate flex-1">{idea.title}</span>
                        </div>
                      )) || <p className="text-sm text-slate-500">No ideas yet</p>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Video Projects */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Video Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <div className="space-y-2">
                      {pipeline?.projects?.map((project: any) => (
                        <div key={project.id} className="p-2 rounded bg-slate-800/50 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{project.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${project.status === 'approved' || project.status === 'uploaded' ? 'border-emerald-500 text-emerald-400' : project.status === 'failed' ? 'border-red-500 text-red-400' : 'border-amber-500 text-amber-400'}`}>
                              {project.status}
                            </Badge>
                            {project.renderProgress > 0 && project.renderProgress < 100 && (
                              <Progress value={project.renderProgress} className="h-2 flex-1" />
                            )}
                            {project.duration && (
                              <span className="text-xs text-slate-400">{project.duration.toFixed(0)}s</span>
                            )}
                          </div>
                        </div>
                      )) || <p className="text-sm text-slate-500">No projects yet</p>}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Uploads */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-40">
                  {pipeline?.uploads?.length ? (
                    <div className="space-y-1">
                      {pipeline.uploads.map((upload: any) => (
                        <div key={upload.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className={`text-xs ${upload.uploadStatus === 'completed' ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}>
                            {upload.uploadStatus}
                          </Badge>
                          <span className="text-slate-300">{upload.title}</span>
                          {upload.youtubeVideoId && (
                            <span className="text-xs text-slate-500 font-mono">{upload.youtubeVideoId}</span>
                          )}
                          <Badge variant="outline" className="text-xs border-slate-600">{upload.privacy}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No uploads yet</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STRATEGY TAB */}
          <TabsContent value="strategy" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base">Channel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {channel?.channel ? (
                    <>
                      <p><span className="text-slate-400">Name:</span> {channel.channel.name}</p>
                      <p><span className="text-slate-400">Niche:</span> {channel.channel.niche}</p>
                      <p><span className="text-slate-400">Positioning:</span> {channel.channel.positioning}</p>
                      <p><span className="text-slate-400">Target:</span> {channel.channel.targetViewer}</p>
                      <p><span className="text-slate-400">Cadence:</span> {channel.channel.uploadCadence}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Channel not configured. Run initial setup.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base">Content Pillars</CardTitle>
                </CardHeader>
                <CardContent>
                  {channel?.pillars?.length ? (
                    <div className="space-y-2">
                      {channel.pillars.map((pillar: any) => (
                        <div key={pillar.id} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pillar.color || '#6366f1' }} />
                          <span className="text-sm">{pillar.name}</span>
                          {pillar.description && <span className="text-xs text-slate-400">- {pillar.description}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No pillars defined</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Niche Analysis */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">Niche Analysis ({channel?.niches?.length || 0} niches)</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {channel?.niches?.length ? (
                    <div className="space-y-1">
                      {channel.niches.map((niche: any) => (
                        <div key={niche.id} className={`flex items-center gap-2 p-1.5 rounded ${niche.isSelected ? 'bg-emerald-900/30 border border-emerald-700' : ''}`}>
                          {niche.isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          <span className="text-sm flex-1">{niche.nicheName}</span>
                          <span className="text-sm font-mono text-emerald-400">{niche.compositeScore.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No niche analysis yet. Run initial setup.</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* JOBS TAB */}
          <TabsContent value="jobs" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">Job Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {jobs.length ? (
                    <div className="space-y-2">
                      {jobs.map((job: any) => (
                        <div key={job.id} className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                          <Badge variant="outline" className={`text-xs ${job.status === 'completed' ? 'border-emerald-500 text-emerald-400' : job.status === 'failed' ? 'border-red-500 text-red-400' : job.status === 'running' ? 'border-cyan-500 text-cyan-400' : 'border-slate-500 text-slate-400'}`}>
                            {job.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-slate-600">{job.type}</Badge>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(job.scheduledAt).toLocaleString()}
                          </span>
                          {job.error && <span className="text-xs text-red-400 truncate">{job.error}</span>}
                          {job.retryCount > 0 && <span className="text-xs text-amber-400">retry #{job.retryCount}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No jobs yet</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">Audit Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {logs.length ? (
                    <div className="space-y-1">
                      {logs.map((log: any) => (
                        <div key={log.id} className="flex gap-2 text-sm p-1">
                          <span className="text-slate-500 font-mono text-xs w-20 shrink-0">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-xs h-5 shrink-0 border-slate-700">{log.action}</Badge>
                          <Badge variant="outline" className="text-xs h-5 shrink-0 border-slate-700">{log.actor}</Badge>
                          <span className="text-slate-300 text-xs truncate">{log.details}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No logs yet</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base">Operating Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {(['simulation', 'private_production', 'autonomous_publication'] as const).map(mode => (
                      <div key={mode} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="mode"
                          checked={status?.operatingMode === mode}
                          onChange={() => sendCommand('set-mode', { mode })}
                          className="accent-emerald-500"
                        />
                        <label className="text-sm capitalize">{modeLabel(mode)}</label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Default: Private Production. Autonomous Publication only after YouTube API audit passes.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base">YouTube Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-500" />
                    <span className="text-sm">
                      {channel?.youtubeConnected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                  {!channel?.youtubeConnected && (
                    <div className="text-xs text-slate-500 space-y-1">
                      <p>To connect YouTube:</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Create a Google Cloud project</li>
                        <li>Enable YouTube Data API v3</li>
                        <li>Configure OAuth 2.0 credentials</li>
                        <li>Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env</li>
                        <li>Click authorize in the OAuth flow</li>
                      </ol>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Uses official Google OAuth 2.0. Tokens encrypted at rest.
                    Minimum scopes: youtube.upload, youtube.readonly.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base">Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-400">
                  <p>✓ OAuth tokens encrypted at rest</p>
                  <p>✓ CSRF protection on OAuth flow</p>
                  <p>✓ Emergency stop control</p>
                  <p>✓ All uploads default to private</p>
                  <p>✓ Audit logging enabled</p>
                  <p>✓ No credentials in source code</p>
                  <p>✓ No passwords or 2FA codes stored</p>
                  <p>✓ Least-privilege API scopes</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-base">Content Policy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-400">
                  <p>✓ Original content only</p>
                  <p>✓ No copied scripts or videos</p>
                  <p>✓ Source attribution required</p>
                  <p>✓ AI content disclosed</p>
                  <p>✓ No fake engagement</p>
                  <p>✓ No misleading thumbnails</p>
                  <p>✓ Asset licence tracking</p>
                  <p>✓ Quality review before upload</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-2 flex items-center justify-between text-xs text-slate-500">
        <span>YouTube Revenue Studio v1.0 • Z.AI Autonomous Agent</span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </footer>
    </div>
  )
}
