import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Suppliers from './pages/Suppliers.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import Approvals from './pages/Approvals.jsx';
import Budgets from './pages/Budgets.jsx';
import Analytics from './pages/Analytics.jsx';
import Monitoring from './pages/Monitoring.jsx';

const NAV = [
  ['/', 'Dashboard'],
  ['/suppliers', 'Suppliers'],
  ['/purchase-orders', 'Purchase Orders'],
  ['/approvals', 'Approvals'],
  ['/budgets', 'Budgets'],
  ['/analytics', 'Spend Analytics'],
  ['/monitoring', 'System Monitoring'],
];

export default function App() {
  return (
    <div className="shell">
      <header className="shellbar">
        <span className="logo">SpendWise</span>
        <span className="subtitle">Intelligent Procurement &amp; Spend Management</span>
      </header>
      <div className="layout">
        <nav className="sidenav">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/monitoring" element={<Monitoring />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
