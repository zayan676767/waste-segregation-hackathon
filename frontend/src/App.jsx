import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ScanPage from './pages/ScanPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import { setting, useAppData } from './lib/useAppData.js';
import { useDevice } from './lib/useDevice.js';
import BrandMark from './components/BrandMark.jsx';

const ROUTE_LABELS = {
  '/': 'Scan',
  '/dashboard': 'Dashboard',
  '/admin': 'Admin'
};

export default function App() {
  const device = useDevice();

  return (
    <Routes>
      {/* The dashboard is projected on a second screen, so it gets the full
          viewport with no app chrome competing for space. */}
      <Route path="/dashboard" element={<DashboardPage device={device} />} />

      <Route
        path="*"
        element={
          <Shell device={device}>
            <Routes>
              {/* Each screen is gated on the device it belongs to. A phone is
                  the scanning tool; a laptop is the projected dashboard and the
                  operator console. Visiting a route the device should not have
                  redirects home rather than rendering it. */}
              <Route
                path="/"
                element={
                  device.isPhone ? <ScanPage /> : <Navigate to={device.homeRoute} replace />
                }
              />
              <Route
                path="/admin"
                element={
                  device.isDesktop ? <AdminPage /> : <Navigate to={device.homeRoute} replace />
                }
              />
              <Route path="*" element={<Navigate to={device.homeRoute} replace />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}

function Shell({ children, device }) {
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
        <div className="flex items-center gap-3">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[0.95rem] font-bold leading-tight tracking-tight text-white">
              {title}
            </h1>
            <p className="eyebrow text-[9px] font-semibold text-white/30">
              {device.isPhone ? 'Point · Capture · Sort' : 'Operator console'}
            </p>
          </div>
        </div>

        <nav className="flex gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1.5">
          {device.allowedRoutes.map((to) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              /* min-h-11 keeps every nav target at the ~44px minimum that is
                 comfortable to hit with a thumb. */
              className={({ isActive }) =>
                `group relative flex min-h-11 flex-1 items-center justify-center overflow-hidden rounded-xl px-3 text-center text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white/12 text-white shadow-inner shadow-white/5'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span>{ROUTE_LABELS[to]}</span>
                  {/* A short accent rule under the active tab. It grows from the
                      centre on activation, which makes switching screens feel
                      like a deliberate move rather than an instant repaint. */}
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-1 h-0.5 rounded-full bg-emerald-400 transition-all duration-300 ${
                      isActive ? 'w-6 opacity-100' : 'w-0 opacity-0'
                    }`}
                  />
                </>
              )}
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
