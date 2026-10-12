import { Check, ChevronsUpDown, X } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: number
  label: string
  hint?: string
}

interface MultiSelectComboboxProps {
  options: ComboboxOption[]
  selected: number[]
  onChange: (values: number[]) => void
  placeholder?: string
  emptyText?: string
}

/** Searchable multi-select with removable chips - used for "which subjects
 * can this teacher teach" (spec: "multi-select with search"). */
export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  emptyText = "No results found.",
}: MultiSelectComboboxProps) {
  const [open, setOpen] = useState(false)
  const selectedOptions = options.filter((o) => selected.includes(o.value))

  const toggle = (value: number) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const remove = (value: number, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter((v) => v !== value))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-auto min-h-9 justify-between font-normal"
        >
          <div className="flex flex-wrap gap-1 py-0.5">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((o) => (
                <Badge key={o.value} variant="secondary" className="gap-1 pr-1">
                  {o.label}
                  <button
                    type="button"
                    onClick={(e) => remove(o.value, e)}
                    aria-label={`Remove ${o.label}`}
                    className="rounded-full hover:bg-foreground/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value)
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    <span>{option.label}</span>
                    {option.hint && <span className="ml-auto text-xs text-muted-foreground">{option.hint}</span>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
