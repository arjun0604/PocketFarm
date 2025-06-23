import { Moon, Sun } from "lucide-react"
<<<<<<< HEAD
=======
import { useTheme } from "next-themes"
>>>>>>> bd89cbc06c263483627aab2fc3138dbac14c09b2

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
<<<<<<< HEAD
import { useTheme } from "@/components/ThemeProvider"

export function ThemeToggle() {
  const { setTheme } = useTheme()
=======

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
>>>>>>> bd89cbc06c263483627aab2fc3138dbac14c09b2

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
<<<<<<< HEAD
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
=======
        <Button variant="outline" size="icon" className="rounded-full">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
>>>>>>> bd89cbc06c263483627aab2fc3138dbac14c09b2
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
<<<<<<< HEAD
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
=======
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <span className="mr-2">💻</span>
          <span>System</span>
>>>>>>> bd89cbc06c263483627aab2fc3138dbac14c09b2
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 