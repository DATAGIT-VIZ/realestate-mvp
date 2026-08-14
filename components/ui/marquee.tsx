import * as React from 'react'
import { cn } from '@/lib/utils'

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  pauseOnHover?: boolean
  direction?: 'left' | 'right'
  speed?: number
}

export function Marquee({
  children,
  pauseOnHover = false,
  direction = 'left',
  speed = 30,
  className,
  ...props
}: MarqueeProps) {
  return (
    <div
      className={cn('w-full overflow-hidden', className)}
      style={{
        maskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)',
      }}
      {...props}
    >
      <div className="relative flex overflow-hidden py-3">
        <div
          className={cn(
            'flex w-max',
            direction === 'right' ? 'animate-marquee-reverse' : 'animate-marquee',
          )}
          style={{
            ['--duration' as string]: `${speed}s`,
            ['--pause-on-hover' as string]: pauseOnHover ? 'paused' : 'running',
          }}
        >
          {children}
          {children}
        </div>
      </div>
    </div>
  )
}
