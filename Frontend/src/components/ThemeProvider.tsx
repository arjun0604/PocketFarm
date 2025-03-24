import { createContext, useContext, useEffect, useState } from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: string
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "pocketfarm-theme",
  ...props
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false)

  // Make sure the component mounts only on the client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <NextThemesProvider
      defaultTheme={defaultTheme}
      storageKey={storageKey}
      enableSystem
      attribute="class"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

// Export a hook for easier theme access
export function useTheme() {
  return useNextTheme()
} 