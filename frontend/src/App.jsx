import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import SolutionDetail from "./pages/SolutionDetail.jsx";
import FacturacionElectronica from "./pages/FacturacionElectronica.jsx";
import TributaryCalendar from "./pages/TributaryCalendar.jsx";
import BillingCalendar from "./pages/BillingCalendar.jsx";
import Login from "./pages/Login.jsx";
import Account from "./pages/Account.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ChatWidget from "./components/ChatWidget.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function Guard({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/soluciones/:slug" element={<SolutionDetail />} />
        <Route path="/facturacion-electronica" element={<FacturacionElectronica />} />
        <Route path="/calendario-tributario" element={<TributaryCalendar />} />
        <Route path="/calendario-facturacion" element={<BillingCalendar />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
        <Route path="/cuenta" element={<Guard><Account /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatWidget />
    </>
  );
}
