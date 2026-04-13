import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  lightText?: boolean;
  /** Fond sous le logo pour mix-blend : `transparent` = pas de plaque (ex. pied de page). */
  blendSurface?: 'primary' | 'secondary' | 'transparent';
}

export default function Logo({
  className = '',
  showText = false,
  lightText = false,
  blendSurface,
}: LogoProps) {
  const sizeClass = className.trim() || 'h-14 md:h-16';
  const blend = Boolean(blendSurface);
  const imgBase =
    'block h-full max-h-full w-auto max-w-full object-contain object-left';
  const imgClasses = blend
    ? `${imgBase} mix-blend-lighten contrast-[1.02]`
    : imgBase;

  const markFallback = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    e.currentTarget.nextElementSibling?.classList.remove('hidden');
  };

  const graphic = (
    <>
      <img
        src="/infinite-core-logo.png"
        alt="Infinite Core"
        className={imgClasses}
        onError={markFallback}
      />

      {/* Fallback SVG Logo (similar to the provided image structure) */}
      <svg
        className={`h-full max-h-full w-auto hidden ${blend ? 'mix-blend-lighten' : ''}`}
        viewBox="0 0 100 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Infinity network structure */}
        <path d="M25 30 C 25 10, 45 10, 50 30 C 55 50, 75 50, 75 30 C 75 10, 55 10, 50 30 C 45 50, 25 50, 25 30 Z" stroke="#2B547E" strokeWidth="1.5" fill="none" />
        <path d="M15 30 C 15 5, 48 5, 50 30 C 52 55, 85 55, 85 30 C 85 5, 52 5, 50 30 C 48 55, 15 55, 15 30 Z" stroke="#2B547E" strokeWidth="1" fill="none" opacity="0.6" />
        <path d="M35 30 C 35 20, 42 20, 50 30 C 58 40, 65 40, 65 30 C 65 20, 58 20, 50 30 C 42 40, 35 40, 35 30 Z" stroke="#2B547E" strokeWidth="1" fill="none" opacity="0.6" />
        
        {/* Nodes */}
        <circle cx="25" cy="30" r="3" fill="#2B547E" />
        <circle cx="75" cy="30" r="3" fill="#2B547E" />
        <circle cx="15" cy="30" r="2.5" fill="#2B547E" />
        <circle cx="85" cy="30" r="2.5" fill="#2B547E" />
        <circle cx="35" cy="20" r="2.5" fill="#8B6B5D" />
        <circle cx="65" cy="40" r="2.5" fill="#8B6B5D" />
        <circle cx="35" cy="40" r="2.5" fill="#8B6B5D" />
        <circle cx="65" cy="20" r="2.5" fill="#8B6B5D" />
        
        {/* Central Core */}
        <circle cx="50" cy="30" r="6" fill="#2B547E" />
        <circle cx="50" cy="30" r="3" fill="#D98A2C" filter="blur(1px)" />
      </svg>
    </>
  );

  return (
    <div
      className={`flex shrink-0 items-center leading-none ${showText ? 'gap-3' : 'gap-0'} ${sizeClass}`}
    >
      {blend ? (
        <div
          className={`isolate flex h-full items-center overflow-hidden rounded-md ${
            blendSurface === 'transparent'
              ? 'bg-transparent'
              : blendSurface === 'secondary'
                ? 'bg-surface-secondary'
                : 'bg-surface-primary'
          }`}
        >
          {graphic}
        </div>
      ) : (
        graphic
      )}

      {showText && (
        <div className="flex flex-col justify-center">
          <span className={`text-3xl font-bold leading-none tracking-tight ${lightText ? 'text-white' : 'text-[#D98A2C]'}`}>
            Infinite
          </span>
          <span className={`text-xl font-light leading-none tracking-widest ${lightText ? 'text-gray-300' : 'text-[#2B547E]'}`}>
            CORE
          </span>
        </div>
      )}
    </div>
  );
}
