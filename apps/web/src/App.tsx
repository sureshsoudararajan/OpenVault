import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AppShell from './layouts/AppShell';
import AuthLayout from './layouts/AuthLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TrashPage from './pages/TrashPage';
import SharedPage from './pages/SharedPage';
import SettingsPage from './pages/SettingsPage';
import ShareLinkPage from './pages/ShareLinkPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    if (isAuthenticated) return <Navigate to="/" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/share/:token" element={<ShareLinkPage />} />

            {/* Auth routes */}
            <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected routes */}
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/folder/:folderId" element={<DashboardPage />} />
                <Route path="/trash" element={<TrashPage />} />
                <Route path="/shared" element={<SharedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>
        </Routes>
    );
}
