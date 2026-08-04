'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Youtube, ExternalLink, CheckCircle2, Copy, Loader2,
  Shield, KeyRound, ArrowRight, ArrowLeft,
  Sparkles, AlertCircle, HelpCircle, Globe,
} from 'lucide-react'

interface YouTubeSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (clientId: string, clientSecret: string) => void
  onDemoMode: () => void
}

type WizardStep = 'method' | 'google-steps' | 'authorize' | 'paste-code' | 'success'

export function YouTubeSetupWizard({ open, onOpenChange, onComplete, onDemoMode }: YouTubeSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('method')
  const [authUrl, setAuthUrl] = useState('')
  const [authState, setAuthState] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [exchanging, setExchanging] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [channelTitle, setChannelTitle] = useState('')

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/youtube/callback`
    : 'http://localhost:3000/api/youtube/callback'

  // Start the OAuth flow — get auth URL from backend
  const startOAuth = async () => {
    setError('')
    try {
      const res = await fetch('/api/youtube/auth')
      const data = await res.json()

      if (!res.ok) {
        if (data.setupRequired) {
          setError(data.message || 'Credentials not configured. Add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to .env')
          return
        }
        setError(data.error || 'Failed to start OAuth flow')
        return
      }

      if (data.connected) {
        setStep('success')
        setChannelTitle(data.channelTitle || 'YouTube')
        return
      }

      setAuthUrl(data.authUrl)
      setAuthState(data.state)
      setStep('authorize')
    } catch (e: any) {
      setError(e.message || 'Network error')
    }
  }

  // Exchange the authorization code for tokens
  const exchangeAuthCode = async () => {
    if (!authCode.trim()) return
    setExchanging(true)
    setError('')
    try {
      const res = await fetch('/api/youtube/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authCode.trim(), state: authState }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || data.error || 'Code exchange failed')
        setExchanging(false)
        return
      }

      setChannelTitle(data.channelTitle || 'YouTube')
      setStep('success')
    } catch (e: any) {
      setError(e.message || 'Network error')
    } finally {
      setExchanging(false)
    }
  }

  const reset = () => {
    setStep('method')
    setAuthUrl('')
    setAuthState('')
    setAuthCode('')
    setError('')
    setChannelTitle('')
  }

  const handleClose = (open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }

  const stepIndex = { 'method': 0, 'google-steps': 1, 'authorize': 2, 'paste-code': 3, 'success': 4 }[step] ?? 0
  const totalSteps = 5

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-100 sm:max-w-xl p-0 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-slate-800">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 to-red-600"
            animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ═══ Step: Choose Method ═══ */}
            {step === 'method' && (
              <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <DialogHeader className="mb-2">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <Youtube className="w-5 h-5 text-red-500" /> Connect YouTube
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">Choose how you want to connect your YouTube channel</DialogDescription>
                </DialogHeader>

                {/* Option 1: Connect with existing credentials */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={startOAuth}
                  className="w-full p-4 rounded-xl border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-left transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                      <Youtube className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">Connect with Google OAuth</p>
                      <p className="text-xs text-slate-400 mt-0.5">Your credentials are already configured. Sign in with Google to authorize the app.</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 mt-1 transition-colors" />
                  </div>
                </motion.button>

                {/* Option 2: Setup from scratch */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setStep('google-steps')}
                  className="w-full p-4 rounded-xl border-2 border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 text-left transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">Set up new Google Cloud project</p>
                      <p className="text-xs text-slate-400 mt-0.5">Walk through creating a project, enabling the API, and generating credentials step by step.</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 mt-1 transition-colors" />
                  </div>
                </motion.button>

                {/* Option 3: Demo Mode */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={onDemoMode}
                  className="w-full p-4 rounded-xl border-2 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-left transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">Demo Mode (no Google needed)</p>
                      <p className="text-xs text-slate-400 mt-0.5">Explore the studio with simulated YouTube data. Switch to real YouTube anytime.</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 mt-1 transition-colors" />
                  </div>
                </motion.button>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Error</p>
                      <p className="text-red-300/80 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ Step: Google Cloud Setup Instructions ═══ */}
            {step === 'google-steps' && (
              <motion.div key="google-steps" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <DialogHeader className="mb-2">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <Globe className="w-5 h-5 text-blue-400" /> Google Cloud Setup
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">Follow these steps if you haven't set up Google Cloud yet</DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  {/* Step 1 */}
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-colors">
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Open Google Cloud Console</span>
                  </a>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-blue-300">1</div>
                    <p className="text-xs text-slate-300">Create a new project (e.g. "YouTube Revenue Studio")</p>
                  </div>

                  <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-colors">
                    <Youtube className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Enable YouTube Data API v3</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>

                  <a href="https://console.cloud.google.com/apis/credentials/oauthclient" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Create OAuth 2.0 Credentials</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-amber-500/30">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-amber-300">2</div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-300 mb-1.5">Add this <strong className="text-amber-300">Redirect URI</strong> in your OAuth credentials:</p>
                      <div className="flex items-center gap-2 p-2 rounded bg-slate-900/80 border border-slate-700/50">
                        <code className="text-[10px] text-amber-300 font-mono break-all flex-1">{redirectUri}</code>
                        <Button size="sm" variant="ghost" className="h-6 px-2 shrink-0 text-slate-400 hover:text-slate-200"
                          onClick={() => copyToClipboard(redirectUri, 'redirect')}>
                          {copied === 'redirect' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-emerald-300">3</div>
                    <p className="text-xs text-slate-300">Copy your <strong>Client ID</strong> and <strong>Client Secret</strong>, then add them to your <code className="text-slate-200 bg-slate-800 px-1 rounded">.env</code> file</p>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep('method')} className="text-slate-400 hover:text-slate-200 gap-1">
                    <ArrowLeft className="w-3 h-3" /> Back
                  </Button>
                  <Button size="sm" onClick={startOAuth} className="bg-red-600 hover:bg-red-500 text-white gap-1.5">
                    <Youtube className="w-3.5 h-3.5" /> Connect Now
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ═══ Step: Authorize with Google ═══ */}
            {step === 'authorize' && (
              <motion.div key="authorize" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <DialogHeader className="mb-2">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <KeyRound className="w-5 h-5 text-amber-400" /> Authorize with Google
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">Open the link below, sign in with Google, and authorize the app</DialogDescription>
                </DialogHeader>

                {/* Important: How this works in sandboxed env */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">How this works:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-amber-300/80">
                    <li>Click the link below to open Google's authorization page</li>
                    <li>Sign in and click <strong>Allow</strong> to authorize the app</li>
                    <li>Google will redirect to a URL — <strong className="text-amber-200">copy the <code>code</code> parameter</strong> from that URL</li>
                    <li>Come back here and paste the code below</li>
                  </ol>
                </div>

                {/* The Google Auth URL */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">Step 1: Open this URL to authorize:</p>
                  <div className="flex items-center gap-2">
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-medium">Open Google Authorization Page</span>
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-slate-700 text-slate-400 hover:text-slate-200 gap-1"
                      onClick={() => copyToClipboard(authUrl, 'authUrl')}
                    >
                      {copied === 'authUrl' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {/* Paste the code */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-300">Step 2: After authorizing, paste the code from the redirect URL:</p>
                  <Input
                    value={authCode}
                    onChange={e => { setAuthCode(e.target.value); setError('') }}
                    placeholder="Paste the code parameter here (e.g., 4/0AX4XfWj...)"
                    className="bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 text-xs h-10 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    The code is in the URL after redirect: <code className="text-slate-400">?code=<span className="text-amber-300">4/0AX4XfWj...</span>&state=...</code>
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Error</p>
                      <p className="text-red-300/80 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep('method')} className="text-slate-400 hover:text-slate-200 gap-1">
                    <ArrowLeft className="w-3 h-3" /> Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={exchangeAuthCode}
                    disabled={!authCode.trim() || exchanging}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white gap-1.5 shadow-lg shadow-red-500/20"
                  >
                    {exchanging ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Connecting...</>
                    ) : (
                      <><CheckCircle2 className="w-3 h-3" /> Connect YouTube</>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ═══ Step: Success ═══ */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                <div className="text-center py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-slate-100 mb-1">YouTube Connected!</h3>
                  <p className="text-sm text-slate-400">
                    {channelTitle ? `Connected to: ${channelTitle}` : 'Your YouTube account is now connected'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Video uploads enabled</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Analytics collection active</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Autonomous publishing available</p>
                </div>

                <Button onClick={() => handleClose(false)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Done
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with step indicators */}
        {step !== 'success' && (
          <div className="px-6 pb-4 flex justify-center">
            <div className="flex gap-1.5">
              {['method', 'google-steps', 'authorize', 'paste-code', 'success'].map((s, i) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    s === step ? 'w-4 bg-red-500' : i < stepIndex ? 'w-1.5 bg-slate-400' : 'w-1.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
