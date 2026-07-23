'use client';

import { useState } from 'react';

type Color = 'blue' | 'emerald';

export default function ChipMultiSelect({
  options,
  selected,
  onChange,
  color = 'blue',
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  color?: Color;
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);

  const active = color === 'blue'
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-emerald-600 text-white border-emerald-600';

  const idleHover = color === 'blue' ? 'hover:border-blue-300' : 'hover:border-emerald-300';

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const isActive = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            aria-pressed={isActive}
            className={`px-2.5 py-1 rounded-full border-2 text-xs font-bold tracking-tight transition ${
              isActive ? active : `bg-white text-slate-600 border-slate-200 ${idleHover}`
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
