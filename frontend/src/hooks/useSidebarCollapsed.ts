import { useCallback, useState } from "react"

const STORAGE_KEY = "sidebar_collapsed"

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === "true")

  const setCollapsed = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(value))
    setCollapsedState(value)
  }, [])

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])

  return { collapsed, setCollapsed, toggle }
}
