import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateOfBirthPickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function DateOfBirthPicker({ 
  value, 
  onChange, 
  placeholder = "Selecione a data de nascimento",
  className 
}: DateOfBirthPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedYear, setSelectedYear] = React.useState<string>(
    value ? value.getFullYear().toString() : ""
  )
  const [selectedMonth, setSelectedMonth] = React.useState<string>(
    value ? value.getMonth().toString() : ""
  )

  // Generate years from 1900 to current year
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i)
  
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]

  // Create date for calendar display based on selected year/month
  const calendarDate = React.useMemo(() => {
    if (selectedYear && selectedMonth) {
      return new Date(parseInt(selectedYear), parseInt(selectedMonth), 1)
    }
    return new Date()
  }, [selectedYear, selectedMonth])

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onChange?.(date)
      setIsOpen(false)
    }
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    if (selectedMonth && value) {
      // Update the date with new year, keeping same month and day
      const newDate = new Date(parseInt(year), parseInt(selectedMonth), value.getDate())
      onChange?.(newDate)
    }
  }

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    if (selectedYear && value) {
      // Update the date with new month, keeping same year and day
      const newDate = new Date(parseInt(selectedYear), parseInt(month), value.getDate())
      onChange?.(newDate)
    }
  }

  // Reset selections when value changes externally
  React.useEffect(() => {
    if (value) {
      setSelectedYear(value.getFullYear().toString())
      setSelectedMonth(value.getMonth().toString())
    } else {
      setSelectedYear("")
      setSelectedMonth("")
    }
  }, [value])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 space-y-4 border-b">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium mb-2 block">Ano</label>
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Mês</label>
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {selectedYear && selectedMonth && (
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            month={calendarDate}
            disabled={(date) => 
              date > new Date() || 
              date < new Date("1900-01-01") ||
              date.getFullYear() !== parseInt(selectedYear) ||
              date.getMonth() !== parseInt(selectedMonth)
            }
            initialFocus
            className="p-3 pointer-events-auto"
          />
        )}
        {(!selectedYear || !selectedMonth) && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Selecione o ano e mês primeiro
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
