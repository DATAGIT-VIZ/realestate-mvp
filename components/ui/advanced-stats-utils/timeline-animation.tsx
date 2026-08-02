'use client'
import React from 'react'
import { motion } from 'motion/react'

interface TimelineAnimationProps {
  children: React.ReactNode
  className?: string
  animationNum?: number
}

export function TimelineAnimation({ children, className, animationNum = 1 }: TimelineAnimationProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: animationNum * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
