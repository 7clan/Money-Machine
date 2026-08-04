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
  Shield, KeyRound, Globe, ArrowRight, ArrowLeft,
  Sparkles, AlertCircle, HelpCircle,
} from 'lucide-react'

interface YouTubeSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (clientId: string, clientSecret: string) => void
  onDemoMode: () => void
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Connect YouTube',
    subtitle: 'Set up Google OAuth 2.0 for video uploads and analytics',
  },
  {
    id: 'project',
    title: 'Create Google Cloud Project',
    subtitle: 'Set up a new project in Google Cloud Console',
  },
  {
    id: 'api',
    title: 'Enable YouTube Data API',
    subtitle: 'Activate the API for your project',
  },
  {
    id: 'credentials',
    title: 'Create OAuth Credentials',
    subtitle: 'Generate your Client ID and Secret',
  },
  {
    id: 'configure',
    title: 'Enter Your Credentials',
    subtitle: 'Paste your Client ID and Client Secret',
  },
]

export function YouTubeSetupWizard({ open, onOpenChange, onComplete, onDemoMode }: YouTubeSetupWizardProps) {
  const [step, setStep] = useState(0)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')

  const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/api/youtube/callback` : 'http://localhost:3000/api/youtube/callback'

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleComplete = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return
    setSaving(true)
    try {
      // Save via API
      const res = await fetch('/api/youtube/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      })
      if (!res.ok) {
        // Fallback: try direct .env write
        const fallbackRes = await fetch('/api/youtube/write-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
        })
      }
      onComplete(clientId.trim(), clientSecret.trim())
    } catch {
      onComplete(clientId.trim(), clientSecret.trim())
    } finally {
      setSaving(false)
    }
  }

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-100 sm:max-w-xl p-0 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-slate-800">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 to-red-600"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Youtube className="w-5 h-5 text-red-500" />
              {STEPS[step].title}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {STEPS[step].subtitle}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-amber-500/10 border border-red-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                      <Youtube className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200 mb-1">Why connect YouTube?</p>
                      <ul className="text-xs text-slate-400 space-y-1">
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> Upload videos directly from the studio</li>
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> Collect real analytics & revenue data</li>
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> Enable autonomous publishing pipeline</li>
                        <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> Track YPP progress toward monetization</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <Shield className="w-5 h-5 text-amber-400 mb-2" />
                    <p className="text-xs font-medium text-slate-200">Secure OAuth 2.0</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Your credentials stay on your server. We never share them.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <Sparkles className="w-5 h-5 text-violet-400 mb-2" />
                    <p className="text-xs font-medium text-slate-200">5-Minute Setup</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Follow the guided steps. We walk you through each one.</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/20 text-xs text-slate-400">
                  <p className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
                    <HelpCircle className="w-3.5 h-3.5" /> No Google account yet?
                  </p>
                  <p>You can use <strong className="text-amber-300">Demo Mode</strong> to explore the studio with simulated YouTube data, then connect your real account later.</p>
                </div>
              </motion.div>
            )}

            {/* Step 1: Create Google Cloud Project */}
            {step === 1 && (
              <motion.div
                key="project"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-blue-300">1</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Go to Google Cloud Console</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Open the console and sign in with your Google account</p>
                    </div>
                  </div>
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Open Google Cloud Console</span>
                    <span className="text-[10px] text-blue-300/60 ml-auto">console.cloud.google.com</span>
                  </a>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-blue-300">2</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Create a new project</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Click the project dropdown at the top → "New Project" → Name it (e.g., "YouTube Revenue Studio") → Create</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-blue-300">3</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Select your new project</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Make sure it's selected in the top bar dropdown</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Enable YouTube Data API */}
            {step === 2 && (
              <motion.div
                key="api"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <a
                    href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <Youtube className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-medium">Open YouTube Data API v3 Page</span>
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </a>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-300">1</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Click "Enable"</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">On the API page, click the big "Enable" button to activate the YouTube Data API v3 for your project</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-300">2</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Wait for it to enable</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">It takes a few seconds. You'll see it listed under "Enabled APIs"</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Create OAuth Credentials */}
            {step === 3 && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <a
                  href="https://console.cloud.google.com/apis/credentials/oauthclient"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium">Open OAuth Credentials Page</span>
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-amber-300">1</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Configure consent screen first</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">If prompted, select "External" user type → Add your email → Add scope <code className="text-amber-300/80 bg-slate-800 px-1 rounded">youtube.upload</code></p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-amber-300">2</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Create OAuth 2.0 Client ID</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Application type: <strong>"Web application"</strong> → Name: "Revenue Studio"</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-amber-500/30">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-amber-300">3</div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-200">Add Authorized Redirect URI</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 mb-2">Under "Authorized redirect URIs", add this exact URI:</p>
                      <div className="flex items-center gap-2 p-2 rounded bg-slate-900/80 border border-slate-700/50">
                        <code className="text-[10px] text-amber-300 font-mono break-all flex-1">{redirectUri}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 shrink-0 text-slate-400 hover:text-slate-200"
                          onClick={() => copyToClipboard(redirectUri, 'redirect')}
                        >
                          {copied === 'redirect' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-amber-300">4</div>
                    <div>
                      <p className="text-xs font-medium text-slate-200">Copy your Client ID and Client Secret</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">After creating, you'll see both values. Copy them — you'll paste them in the next step.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Enter Credentials */}
            {step === 4 && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 block">YouTube Client ID</label>
                    <Input
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      placeholder="e.g., 123456789-abc.apps.googleusercontent.com"
                      className="bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 text-xs h-10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1.5 block">YouTube Client Secret</label>
                    <Input
                      value={clientSecret}
                      onChange={e => setClientSecret(e.target.value)}
                      placeholder="e.g., GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx"
                      type="password"
                      className="bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 text-xs h-10"
                    />
                  </div>

                  {clientId && clientSecret && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-medium">Credentials entered — ready to save!</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/20 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
                    <Shield className="w-3.5 h-3.5" /> Security Note
                  </div>
                  <p>These credentials will be saved to your <code className="text-slate-300 bg-slate-800 px-1 rounded">.env</code> file on the server. They are never sent to any third party. The OAuth flow uses Google's secure authorization endpoint.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer: Navigation + Demo Mode */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/50">
            <div>
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={prev} className="text-slate-400 hover:text-slate-200 gap-1">
                  <ArrowLeft className="w-3 h-3" /> Back
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onDemoMode} className="text-amber-400/80 hover:text-amber-300 gap-1">
                  <Sparkles className="w-3 h-3" /> Demo Mode
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Step indicators */}
              <div className="flex gap-1 mr-3">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? 'bg-red-500' : i < step ? 'bg-slate-400' : 'bg-slate-700'}`}
                  />
                ))}
              </div>

              {step < STEPS.length - 1 ? (
                <Button size="sm" onClick={next} className="bg-red-600 hover:bg-red-500 text-white gap-1">
                  Next <ArrowRight className="w-3 h-3" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={!clientId.trim() || !clientSecret.trim() || saving}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white gap-1.5 shadow-lg shadow-red-500/20"
                >
                  {saving ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle2 className="w-3 h-3" /> Save & Connect</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
