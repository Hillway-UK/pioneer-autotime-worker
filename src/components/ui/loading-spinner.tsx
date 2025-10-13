import { cn } from "@/lib/utils"
import { MapPin, Camera, Navigation } from "lucide-react"

interface LoadingSpinnerProps {
  type?: 'location' | 'photo' | 'verification' | 'default'
  message?: string
  className?: string
}

export function LoadingSpinner({ type = 'default', message, className }: LoadingSpinnerProps) {
  const getIcon = () => {
    switch (type) {
      case 'location':
        return <MapPin className="h-6 w-6 animate-bounce text-primary" />
      case 'photo':
        return <Camera className="h-6 w-6 animate-pulse text-primary" />
      case 'verification':
        return <Navigation className="h-6 w-6 animate-spin-slow text-primary" />
      default:
        return (
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )
    }
  }

  const getDefaultMessage = () => {
    switch (type) {
      case 'location':
        return 'Finding your location...'
      case 'photo':
        return 'Processing photo...'
      case 'verification':
        return 'Verifying job site...'
      default:
        return 'Loading...'
    }
  }

  return (
    <div className={cn("flex flex-col items-center justify-center space-y-3 p-6", className)}>
      {getIcon()}
      <p className="text-sm text-muted-foreground font-medium animate-pulse">
        {message || getDefaultMessage()}
      </p>
    </div>
  )
}