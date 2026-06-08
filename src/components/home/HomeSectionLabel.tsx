import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Accent = 'gold' | 'blue' | 'neutral';

const accentStyles: Record<Accent, { text: string; line: string; pill?: string }> = {
  gold: {
    text: 'text-noya-orange',
    line: 'bg-noya-orange',
    pill: 'border-noya-orange/25 bg-noya-orange/5 text-noya-orange',
  },
  blue: {
    text: 'text-[#6EA7EA]',
    line: 'bg-[#6EA7EA]',
    pill: 'border-[#6EA7EA]/30 bg-[#6EA7EA]/5 text-[#6EA7EA]',
  },
  neutral: {
    text: 'text-text-secondary',
    line: 'bg-white/20',
  },
};

type Props = {
  children: ReactNode;
  accent?: Accent;
  centered?: boolean;
  variant?: 'line' | 'pill';
  className?: string;
};

export default function HomeSectionLabel({
  children,
  accent = 'gold',
  centered = false,
  variant = 'line',
  className,
}: Props) {
  const a = accentStyles[accent];

  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em]',
          a.pill,
          centered && 'mx-auto',
          className,
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'mb-4 flex items-center text-[10px] font-bold uppercase tracking-[0.15em]',
        a.text,
        centered && 'justify-center',
        'before:mr-3 before:block before:h-px before:w-6 before:shrink-0 before:content-[""]',
        centered && 'after:ml-3 after:block after:h-px after:w-6 after:shrink-0 after:content-[""]',
        accent === 'gold' && 'before:bg-noya-orange after:bg-noya-orange',
        accent === 'blue' && 'before:bg-[#6EA7EA] after:bg-[#6EA7EA]',
        accent === 'neutral' && 'before:bg-white/20 after:bg-white/20',
        !centered && 'after:hidden',
        className,
      )}
    >
      {children}
    </span>
  );
}
