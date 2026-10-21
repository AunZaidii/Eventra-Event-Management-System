import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../ui/Logo';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

const navLink = ({ isActive }) =>
  `flex min-h-11 items-center rounded-[10px] px-3.5 text-[15px] font-medium transition-colors ${
    isActive ? 'text-ink' : 'text-muted hover:text-ink'
  }`;

// Navbar + page + footer for the public site.
export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const adminLink = isAuthenticated ? '/admin' : '/admin/login';

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-2 sm:flex">
            <NavLink to="/" end className={navLink}>
              Events
            </NavLink>
            <Button to={adminLink} variant="dark" size="sm" className="ml-1 !min-h-11 !px-4.5 !rounded-btn">
              {isAuthenticated ? 'Dashboard' : 'Admin login'}
            </Button>
          </nav>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl border border-line sm:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <nav aria-label="Mobile" className="flex flex-col gap-1 border-t border-line px-4 pt-2 pb-4 sm:hidden">
            <NavLink to="/" end className={navLink} onClick={() => setOpen(false)}>
              Events
            </NavLink>
            <Button to={adminLink} variant="dark" onClick={() => setOpen(false)}>
              {isAuthenticated ? 'Dashboard' : 'Admin login'}
            </Button>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="no-print border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <span>
            <span className="font-display text-lg font-extrabold text-ink">Eventra</span> · Event Management System
          </span>
          <span>Cloud Computing project · React · Express · PostgreSQL</span>
        </div>
      </footer>
    </div>
  );
}
