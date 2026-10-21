import { CATEGORIES } from '../../lib/categories';

// Pill buttons to filter by category ("All" clears the filter).
export default function CategoryChips({ value, onChange }) {
  const options = ['All', ...CATEGORIES];
  return (
    <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
      {options.map((option) => {
        const active = option === 'All' ? !value : value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option === 'All' ? '' : option)}
            className={`min-h-11 shrink-0 rounded-full border px-[18px] text-[15px] font-semibold transition-colors ${
              active
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-ink-2 hover:border-brand-300'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
