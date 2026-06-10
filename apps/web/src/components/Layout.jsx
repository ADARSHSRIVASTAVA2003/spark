import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/feed', label: 'Feed', icon: '🔥' },
  { to: '/nearby', label: 'Nearby', icon: '📍' },
  { to: '/matches', label: 'Matches', icon: '💜' },
  { to: '/chat', label: 'Chat', icon: '💬' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export default function Layout() {
  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-900">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-gray-200 bg-white/95 backdrop-blur">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? 'text-violet-600' : 'text-gray-500'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
