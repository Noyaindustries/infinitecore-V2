import React, { useState } from 'react';

const LOGO_SRC = '/infinite-core-logo.png';

interface LogoProps {
  className?: string;
  showText?: boolean;
  lightText?: boolean;
  /** Fond sous le logo pour mix-blend : `transparent` = pas de plaque (ex. pied de page). */
  blendSurface?: 'primary' | 'secondary' | 'transparent';
  /**
   * Teinte alignée sur le menu marketing (liens `#8E9EAE`, survol `#F5F7FF`).
   * Le parent du lien doit inclure `group/logo` pour le survol.
   */
  matchMarketingNav?: boolean;
}

function MarkSvgFallback({
  monochrome,
  className = '',
}: {
  monochrome?: boolean;
  className?: string;
}) {
  const stroke = monochrome ? 'currentColor' : '#2B547E';
  const fillMain = monochrome ? 'currentColor' : '#2B547E';
  const fillAccent = monochrome ? 'currentColor' : '#8B6B5D';
  const coreInner = monochrome ? 'currentColor' : '#D98A2C';
  const a11y = monochrome
    ? ({ role: 'img' as const, 'aria-label': 'Infinite Core' } as const)
    : ({ 'aria-hidden': true as const } as const);

  return (
    <svg
      className={`h-full max-h-full w-auto text-current ${className}`.trim()}
      viewBox="0 0 100 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      <path
        d="M25 30 C 25 10, 45 10, 50 30 C 55 50, 75 50, 75 30 C 75 10, 55 10, 50 30 C 45 50, 25 50, 25 30 Z"
        stroke={stroke}
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M15 30 C 15 5, 48 5, 50 30 C 52 55, 85 55, 85 30 C 85 5, 52 5, 50 30 C 48 55, 15 55, 15 30 Z"
        stroke={stroke}
        strokeWidth="1"
        fill="none"
        opacity={monochrome ? 0.55 : 0.6}
      />
      <path
        d="M35 30 C 35 20, 42 20, 50 30 C 58 40, 65 40, 65 30 C 65 20, 58 20, 50 30 C 42 40, 35 40, 35 30 Z"
        stroke={stroke}
        strokeWidth="1"
        fill="none"
        opacity={monochrome ? 0.55 : 0.6}
      />
      <circle cx="25" cy="30" r="3" fill={fillMain} />
      <circle cx="75" cy="30" r="3" fill={fillMain} />
      <circle cx="15" cy="30" r="2.5" fill={fillMain} />
      <circle cx="85" cy="30" r="2.5" fill={fillMain} />
      <circle cx="35" cy="20" r="2.5" fill={fillAccent} className={monochrome ? 'opacity-50' : ''} />
      <circle cx="65" cy="40" r="2.5" fill={fillAccent} className={monochrome ? 'opacity-50' : ''} />
      <circle cx="35" cy="40" r="2.5" fill={fillAccent} className={monochrome ? 'opacity-50' : ''} />
      <circle cx="65" cy="20" r="2.5" fill={fillAccent} className={monochrome ? 'opacity-50' : ''} />
      <circle cx="50" cy="30" r="6" fill={fillMain} />
      <circle cx="50" cy="30" r="3" fill={coreInner} opacity={monochrome ? 0.45 : 1} filter={monochrome ? undefined : 'blur(1px)'} />
    </svg>
  );
}

export default function Logo({
  className = '',
  showText = false,
  lightText = false,
  blendSurface,
  matchMarketingNav = false,
}: LogoProps) {
  const [marketingImgFailed, setMarketingImgFailed] = useState(false);
  const sizeClass = className.trim() || 'h-12 md:h-[5rem]';
  const blend = Boolean(blendSurface) && !matchMarketingNav;
  const imgBase =
    'block h-full max-h-full w-auto max-w-full object-contain object-left';
  const imgClasses = blend
    ? `${imgBase} mix-blend-lighten contrast-[1.02]`
    : imgBase;

  const markFallback = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    e.currentTarget.nextElementSibling?.classList.remove('hidden');
  };

  const graphic = matchMarketingNav ? (
    marketingImgFailed ? (
      <MarkSvgFallback monochrome />
    ) : (
      <img
        src={LOGO_SRC}
        alt="Infinite Core"
        className="pointer-events-none block h-full w-auto max-h-full max-w-full object-contain object-left opacity-100"
        onError={() => setMarketingImgFailed(true)}
      />
    )
  ) : (
    <>
      <img
        src={LOGO_SRC}
        alt="Infinite Core"
        className={imgClasses}
        onError={markFallback}
      />

      <MarkSvgFallback className={`hidden ${blend ? 'mix-blend-lighten' : ''}`} />
    </>
  );

  const graphicBlock =
    matchMarketingNav ? (
      <div className="flex h-full items-center text-[#8E9EAE] transition-colors duration-150 group-hover/logo:text-[#F5F7FF]">
        {graphic}
      </div>
    ) : (
      graphic
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
          {graphicBlock}
        </div>
      ) : (
        graphicBlock
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
