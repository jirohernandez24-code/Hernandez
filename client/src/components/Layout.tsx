import { NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-medical-blue rounded-lg flex items-center justify-center text-white font-bold text-lg">
              NS
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">NurseSim</h1>
              <p className="text-xs text-gray-500">Interactive Nursing Simulator</p>
            </div>
          </div>
          <nav className="flex gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-medical-blue text-white' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              Upload PDF
            </NavLink>
            <NavLink
              to="/scenarios"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-medical-blue text-white' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              Scenario Library
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
