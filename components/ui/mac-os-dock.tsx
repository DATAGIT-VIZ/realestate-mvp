'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

export interface DockApp {
  id: string;
  name: string;
  icon: string; // img src — data URI or URL
}

interface MacOSDockProps {
  apps: DockApp[];
  onAppClick?: (appId: string) => void;
  openApps?: string[];
  /** Override responsive sizing — useful for scaled-down mocks */
  iconSize?: number;
  maxScale?: number;
  effectWidth?: number;
  className?: string;
}

const MacOSDock: React.FC<MacOSDockProps> = ({
  apps,
  onAppClick,
  openApps = [],
  iconSize: iconSizeProp,
  maxScale: maxScaleProp,
  effectWidth: effectWidthProp,
  className = '',
}) => {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [currentScales, setCurrentScales] = useState<number[]>(() => apps.map(() => 1));
  const [currentPositions, setCurrentPositions] = useState<number[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastMouseMoveTime = useRef<number>(0);
  const mouseXRef = useRef<number | null>(null);
  const currentScalesRef = useRef<number[]>(apps.map(() => 1));
  const currentPositionsRef = useRef<number[]>([]);

  // Responsive config — overrideable via props
  const getConfig = useCallback(() => {
    if (iconSizeProp) {
      return {
        baseIconSize: iconSizeProp,
        maxScale: maxScaleProp ?? 1.65,
        effectWidth: effectWidthProp ?? iconSizeProp * 5,
      };
    }
    if (typeof window === 'undefined') {
      return { baseIconSize: 56, maxScale: 1.7, effectWidth: 240 };
    }
    const smaller = Math.min(window.innerWidth, window.innerHeight);
    if (smaller < 480)  return { baseIconSize: Math.max(40, smaller * 0.08), maxScale: 1.4, effectWidth: smaller * 0.4 };
    if (smaller < 768)  return { baseIconSize: Math.max(48, smaller * 0.07), maxScale: 1.5, effectWidth: smaller * 0.35 };
    if (smaller < 1024) return { baseIconSize: Math.max(56, smaller * 0.06), maxScale: 1.6, effectWidth: smaller * 0.3 };
    return { baseIconSize: Math.max(64, Math.min(80, smaller * 0.05)), maxScale: 1.8, effectWidth: 300 };
  }, [iconSizeProp, maxScaleProp, effectWidthProp]);

  const [config, setConfig] = useState(getConfig);
  const { baseIconSize, maxScale, effectWidth } = config;
  const minScale = 1.0;
  const baseSpacing = Math.max(3, baseIconSize * 0.07);

  useEffect(() => {
    if (!iconSizeProp) {
      const onResize = () => setConfig(getConfig());
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  }, [getConfig, iconSizeProp]);

  // Cosine magnification curve — authentic macOS feel
  const calcTargetScales = useCallback((mx: number | null) => {
    if (mx === null) return apps.map(() => minScale);
    return apps.map((_, i) => {
      const center = i * (baseIconSize + baseSpacing) + baseIconSize / 2;
      const minX = mx - effectWidth / 2;
      const maxX = mx + effectWidth / 2;
      if (center < minX || center > maxX) return minScale;
      const theta = ((center - minX) / effectWidth) * 2 * Math.PI;
      const factor = (1 - Math.cos(Math.min(Math.max(theta, 0), 2 * Math.PI))) / 2;
      return minScale + factor * (maxScale - minScale);
    });
  }, [apps, baseIconSize, baseSpacing, effectWidth, maxScale, minScale]);

  const calcPositions = useCallback((scales: number[]) => {
    let x = 0;
    return scales.map(scale => {
      const w = baseIconSize * scale;
      const cx = x + w / 2;
      x += w + baseSpacing;
      return cx;
    });
  }, [baseIconSize, baseSpacing]);

  // Init
  useEffect(() => {
    const scales = apps.map(() => minScale);
    const positions = calcPositions(scales);
    currentScalesRef.current = scales;
    currentPositionsRef.current = positions;
    setCurrentScales(scales);
    setCurrentPositions(positions);
  }, [apps, calcPositions, minScale, config]);

  // RAF animation loop using refs to avoid stale closure issues
  const animate = useCallback(() => {
    const mx = mouseXRef.current;
    const targetScales = calcTargetScales(mx);
    const targetPositions = calcPositions(targetScales);
    const lerp = mx !== null ? 0.2 : 0.12;

    const newScales = currentScalesRef.current.map((s, i) => s + (targetScales[i] - s) * lerp);
    const newPositions = currentPositionsRef.current.map((p, i) => p + (targetPositions[i] - p) * lerp);

    currentScalesRef.current = newScales;
    currentPositionsRef.current = newPositions;
    setCurrentScales([...newScales]);
    setCurrentPositions([...newPositions]);

    const needsMore =
      newScales.some((s, i) => Math.abs(s - targetScales[i]) > 0.002) ||
      newPositions.some((p, i) => Math.abs(p - targetPositions[i]) > 0.1) ||
      mx !== null;

    if (needsMore) animationFrameRef.current = requestAnimationFrame(animate);
  }, [calcTargetScales, calcPositions]);

  const startAnimation = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const now = performance.now();
    if (now - lastMouseMoveTime.current < 16) return;
    lastMouseMoveTime.current = now;
    if (dockRef.current) {
      const rect = dockRef.current.getBoundingClientRect();
      const padding = Math.max(6, baseIconSize * 0.1);
      const mx = e.clientX - rect.left - padding;
      mouseXRef.current = mx;
      setMouseX(mx);
      startAnimation();
    }
  }, [baseIconSize, startAnimation]);

  const handleMouseLeave = useCallback(() => {
    mouseXRef.current = null;
    setMouseX(null);
    startAnimation();
  }, [startAnimation]);

  useEffect(() => () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const contentWidth = currentPositions.length > 0
    ? Math.max(...currentPositions.map((p, i) => p + (baseIconSize * (currentScales[i] ?? 1)) / 2))
    : apps.length * (baseIconSize + baseSpacing) - baseSpacing;

  const padding = Math.max(6, baseIconSize * 0.1);
  const dotSize = Math.max(2.5, baseIconSize * 0.05);

  return (
    <div
      ref={dockRef}
      className={className}
      style={{
        width: `${contentWidth + padding * 2}px`,
        background: 'rgba(220,225,235,0.22)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderRadius: `${Math.max(10, baseIconSize * 0.28)}px`,
        border: '1px solid rgba(255,255,255,0.32)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.4)',
        padding: `${padding}px`,
        paddingBottom: `${padding + dotSize + 2}px`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative" style={{ height: `${baseIconSize}px`, width: '100%', overflow: 'visible' }}>
        {apps.map((app, i) => {
          const scale = currentScales[i] ?? 1;
          const pos = currentPositions[i] ?? 0;
          const sz = baseIconSize * scale;
          const isOpen = openApps.includes(app.id);

          return (
            <div
              key={app.id}
              className="absolute flex flex-col items-center justify-end cursor-pointer"
              title={app.name}
              onClick={() => onAppClick?.(app.id)}
              style={{
                left: `${pos - sz / 2}px`,
                bottom: 0,
                width: `${sz}px`,
                height: `${sz}px`,
                zIndex: Math.round(scale * 10),
                transform: isOpen ? 'translateY(-7px)' : 'translateY(0px)',
                transition: 'transform 0.35s cubic-bezier(0.22,1,0.36,1)',
                animation: isOpen ? 'dock-open-bounce 0.6s cubic-bezier(0.22,1,0.36,1)' : 'none',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={app.icon}
                alt={app.name}
                width={sz}
                height={sz}
                draggable={false}
                style={{
                  objectFit: 'contain',
                  filter: `drop-shadow(0 ${scale > 1.2 ? Math.max(2, baseIconSize * 0.04) : Math.max(1, baseIconSize * 0.02)}px ${scale > 1.2 ? Math.max(6, baseIconSize * 0.12) : Math.max(3, baseIconSize * 0.06)}px rgba(0,0,0,${0.25 + (scale - 1) * 0.18}))`,
                }}
              />
              {/* Active indicator dot */}
              <div
                style={{
                  position: 'absolute',
                  bottom: `-${dotSize + 2}px`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: dotSize,
                  height: dotSize,
                  borderRadius: '50%',
                  background: isOpen ? 'rgba(255,255,255,0.85)' : 'transparent',
                  boxShadow: isOpen ? '0 0 4px rgba(0,0,0,0.3)' : 'none',
                  transition: 'background 0.2s',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MacOSDock;
