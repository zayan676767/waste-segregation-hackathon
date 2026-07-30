import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import ScanPage from './pages/ScanPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import { setting, useAppData } from './lib/useAppData.js';

const NAV = [
  { to: '/', label: 'Scan' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/admin', label: 'Admin' }
];

export default function App() {
  return (
    <Routes>
      {/* The dashboard is projected on a second screen, so it gets the full
          viewport with no app chrome competing for space. */}
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route
        path="*"
        element={
          <Shell>
            <Routes>
              <Route path="/" element={<ScanPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<ScanPage />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}

function Shell({ children }) {
  const { settings } = useAppData();
  const title = setting(settings, 'app_title', 'Smart Waste Segregation Assistant');

  // The scan page is phone-first and stays narrow; admin holds forms and a table
  // and gets more room when there is a laptop screen to use.
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <div
      className={`mx-auto flex min-h-screen w-full flex-col px-4 pb-safe pt-safe ${
        isAdmin ? 'max-w-3xl' : 'max-w-lg'
      }`}
    >
      <header className="mb-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden="true">
            ♻️
          </span>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-white">
            {title}
          </h1>
        </div>

        <nav className="flex gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              /* min-h-11 keeps every nav target at the ~44px minimum that is
                 comfortable to hit with a thumb. */
              className={({ isActive }) =>
                `flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-center text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white/12 text-white'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Keyed on the route so each screen fades in instead of snapping. */}
      <main key={pathname} className="animate-fade-up flex-1">
        {children}
      </main>
    </div>
  );
}
