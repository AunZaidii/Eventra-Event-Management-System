import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';

export default function Logo({ to = '/', dark = false, suffix }) {
  return (
    <Link to={to} className={`flex items-center gap-2.5 ${dark ? 'text-white' : 'text-ink'}`} aria-label="Eventra home">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-600">
        <Ticket className="size-5 text-white" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="font-display text-[22px] font-extrabold tracking-tight">
        Eventra
        {suffix && <span className="ml-1.5 font-sans text-xs font-semibold text-brand-300">{suffix}</span>}
      </span>
    </Link>
  );
}
