'use client'

import * as React from 'react'
import { useRef } from 'react'
import { MotionValue, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'
import Link from 'next/link'

const cn = (...args: any[]) => twMerge(clsx(args))

export interface DockItemData {
  link: string
  Icon: React.ReactNode
  label?: string
  target?: string
}

export interface AnimatedDockProps {
  className?: string
  items: DockItemData[]
}

export function AnimatedDock({ className, items }: AnimatedDockProps) {
  const mouseX = useMotionValue(Infinity)

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        'mx-auto flex h-16 items-end gap-4 rounded-2xl px-4 pb-3',
        className,
      )}
    >
      {items.map((item, index) => (
        <DockItem key={index} mouseX={mouseX} label={item.label}>
          <Link
            href={item.link}
            target={item.target}
            className="grow flex items-center justify-center w-full h-full"
          >
            {item.Icon}
          </Link>
        </DockItem>
      ))}
    </motion.div>
  )
}

interface DockItemProps {
  mouseX: MotionValue<number>
  children: React.ReactNode
  label?: string
}

function DockItem({ mouseX, children, label }: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = React.useState(false)

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })

  const widthSync = useTransform(distance, [-150, 0, 150], [40, 72, 40])
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 })

  const iconScale = useTransform(width, [40, 72], [1, 1.4])
  const iconSpring = useSpring(iconScale, { mass: 0.1, stiffness: 150, damping: 12 })

  return (
    <div className="relative flex flex-col items-center">
      {label && hovered && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="absolute -top-8 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white"
          style={{ background: 'rgba(38,50,56,0.85)', backdropFilter: 'blur(6px)' }}
        >
          {label}
        </motion.div>
      )}
      <motion.div
        ref={ref}
        style={{ width, background: '#0038A8' } as any}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="aspect-square rounded-full flex items-center justify-center text-white"
      >
        <motion.div
          style={{ scale: iconSpring }}
          className="flex items-center justify-center w-full h-full"
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  )
}
