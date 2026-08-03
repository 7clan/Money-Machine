'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

/**
 * ThemeToggle
 *
 * Compact icon button (w-9 h-9) for the dashboard header.
 *
 * - Shows a Sun icon when the active theme is Dark (signaling the user can
 *   switch toward light), and a Moon icon when Light.
 * - The icon morphs smoothly between states via framer-motion AnimatePresence
 *   (rotation + opacity + scale).
 * - Clicking the button opens a shadcn DropdownMenu with three options
 *   (Light / Dark / System). The currently active option shows a Check icon.
 * - Hydration-safe: renders the dark-state icon until mounted (matches
 *   `defaultTheme="dark"` from the ThemeProvider).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Until mounted, `theme` is undefined on the server. Default to dark so the
  // server-rendered markup matches the client's first paint (defaultTheme="dark").
  const currentTheme = mounted ? theme : 'dark'
  const isDark = currentTheme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Toggle theme. Current: ${isDark ? 'dark' : 'light'}`}
          aria-haspopup="menu"
          title="Toggle theme"
          className="size-9 rounded-md p-0 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:hover:text-white"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.span
                key="sun"
                initial={{ rotate: -90, opacity: 0, scale: 0.4 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="flex items-center justify-center"
              >
                <Sun className="size-4" />
              </motion.span>
            ) : (
              <motion.span
                key="moon"
                initial={{ rotate: 90, opacity: 0, scale: 0.4 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="flex items-center justify-center"
              >
                <Moon className="size-4" />
              </motion.span>
            )}
          </AnimatePresence>
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {themeOptions.map((option) => {
          const isActive = mounted && theme === option.value
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="flex cursor-pointer items-center justify-between gap-3"
              aria-checked={isActive}
              role="menuitemradio"
            >
              <span className="flex items-center gap-2">
                {option.value === 'light' && <Sun className="size-4" />}
                {option.value === 'dark' && <Moon className="size-4" />}
                {option.label}
              </span>
              {isActive && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
