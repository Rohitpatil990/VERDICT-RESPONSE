import React, { useEffect, useState, useRef } from 'react';

interface GuidedDemoCursorProps {
  targetSelector: string | null;
  stepName: string;
  tooltipText: string;
  visible: boolean;
  statusText?: string;
}

export const GuidedDemoCursor: React.FC<GuidedDemoCursorProps> = ({
  targetSelector,
  stepName,
  tooltipText,
  visible,
  statusText
}) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const prevTargetRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!visible || !targetSelector) {
      if (prevTargetRef.current) {
        prevTargetRef.current.classList.remove('ring-4', 'ring-primaryAction', 'ring-offset-2', 'ring-offset-background', 'transition-all');
        prevTargetRef.current = null;
      }
      return;
    }

    const updatePosition = () => {
      const el = document.querySelector(targetSelector);
      if (el) {
        // Highlight element
        if (prevTargetRef.current && prevTargetRef.current !== el) {
          prevTargetRef.current.classList.remove('ring-4', 'ring-primaryAction', 'ring-offset-2', 'ring-offset-background', 'transition-all');
        }
        el.classList.add('ring-4', 'ring-primaryAction', 'ring-offset-2', 'ring-offset-background', 'transition-all');
        prevTargetRef.current = el;

        // Scroll element into view smoothly if offscreen
        const rect = el.getBoundingClientRect();
        const isInViewport =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth);

        if (!isInViewport) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        const freshRect = el.getBoundingClientRect();
        setCoords({
          x: Math.round(freshRect.left + freshRect.width / 2),
          y: Math.round(freshRect.top + freshRect.height / 2)
        });
      }
    };

    updatePosition();
    const interval = setInterval(updatePosition, 300);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      if (prevTargetRef.current) {
        prevTargetRef.current.classList.remove('ring-4', 'ring-primaryAction', 'ring-offset-2', 'ring-offset-background', 'transition-all');
        prevTargetRef.current = null;
      }
    };
  }, [targetSelector, visible]);

  if (!visible || !coords) return null;

  return (
    <div
      className="fixed pointer-events-none z-50 transition-all duration-700 ease-out"
      style={{
        transform: `translate3d(${coords.x}px, ${coords.y}px, 0)`
      }}
    >
      {/* Target Pulsing Target Ring */}
      <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full border-2 border-primaryAction animate-ping opacity-75" />

      {/* SVG Custom Demo Cursor */}
      <svg
        className="w-7 h-7 drop-shadow-lg text-primaryAction fill-primaryAction"
        viewBox="0 0 24 24"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M3 3l7 18 3-7 7-3L3 3z"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* Cursor Badge & Tooltip */}
      <div className="absolute top-5 left-5 w-64 bg-slate-900/95 text-white p-3 rounded-lg shadow-2xl border border-blue-400/50 backdrop-blur-xs text-xs space-y-1 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            VERDICT Demo Guide
          </span>
          {statusText && (
            <span className="text-[9px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
              {statusText}
            </span>
          )}
        </div>
        <div className="font-bold text-slate-100 text-[11px]">{stepName}</div>
        <div className="text-[11px] text-slate-300 leading-snug">{tooltipText}</div>
      </div>
    </div>
  );
};
