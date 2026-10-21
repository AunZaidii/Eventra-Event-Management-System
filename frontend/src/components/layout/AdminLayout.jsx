import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, ExternalLink, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react';
import Logo from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/registrations', label: 'Registrations', icon: Users },
];

const itemClass = ({ isActive }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
    isActive ? 'bg-brand-600 font-semibold text-white' : 'font-medium text-mist hover:bg-white/10 hover:text-white'
  }`;

function SidebarContent({ onNavigate }) {
  const { auth, logout } = useAuth();
  return (
    <>
      <nav aria-label="Admin" className="flex flex-col gap-1">
        {LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={itemClass} onClick={onNavigate}>
            <Icon className="size-[18px]" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
        {auth?.admin?.email && <p className="truncate px-3 pb-2 text-xs text-mist">Signed in as {auth.admin.email}</p>}
        <NavLink to="/" className={itemClass({ isActive: false })} onClick={onNavigate}>
          <ExternalLink className="size-[18px]" aria-hidden="true" />
          View public site
        </NavLink>
        <button type="button" onClick={logout} className={`${itemClass({ isActive: false })} w-full text-left`}>
          <LogOut className="size-[18px]" aria-hidden="true" />
          Log out
        </button>
      </div>
    </>
  );
}

// Dark sidebar on desktop; collapsible top bar on tablets and phones.
export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-7 bg-ink px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo to="/admin" dark suffix="Admin" />
        </div>
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 bg-ink lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo to="/admin" dark suffix="Admin" />
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl text-white hover:bg-white/10"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <div className="flex flex-col gap-4 px-4 pb-4">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        )}
      </header>

      <main id="main" className="min-w-0 flex-1 px-4 pt-8 pb-14 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1180px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
