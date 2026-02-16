import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Core Pages
import SplashScreen from "./pages/SplashScreen";
import LoginPage from "./pages/LoginPage";
import RecordActivity from "./pages/RecordActivity";
import NotFound from "./pages/NotFound";

// New Owner Pages
import OwnerSignup from "./pages/owner/OwnerSignup";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import CreateFarm from "./pages/owner/CreateFarm";
import EditFarm from "./pages/owner/EditFarm";
import AddUser from "./pages/owner/AddUser";
import ManageUsers from "./pages/owner/ManageUsers";
import OwnerProfile from "./pages/owner/OwnerProfile";
import ManageFarms from "./pages/owner/ManageFarms";
import OwnerActivityLogs from "./pages/owner/OwnerActivityLogs";
import OwnerConsolidatedReports from "./pages/owner/OwnerConsolidatedReports";

// New User Pages
import UserDashboard from "./pages/user/UserDashboard";
import UserProfile from "./pages/user/UserProfile";
import UserDailyReport from "./pages/user/UserDailyReport";

const queryClient = new QueryClient();

// Only allow authenticated users (Any role)
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null; // Or a spinner
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Only allow Owners
const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;

  if (!user) return <Navigate to="/owner/login" replace />;
  if (user.role !== 'owner') return <Navigate to="/user/dashboard" replace />;

  return <>{children}</>;
};

// Redirects legacy dashboard to unified user dashboard
const UserRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'owner') return <Navigate to="/owner/dashboard" replace />;

  return <>{children}</>;
};

// Helper to redirect /dashboard to role-specific ones
const DashboardRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'owner' ? '/owner/dashboard' : '/user/dashboard'} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<SplashScreen />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Legacy redir */}
            <Route path="/welcome" element={<Navigate to="/login" replace />} />
            <Route path="/owner/login" element={<Navigate to="/login" replace />} />
            <Route path="/user/login" element={<Navigate to="/login" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

            {/* OWNER PORTAL */}
            <Route path="/owner/signup" element={<OwnerSignup />} />
            <Route path="/owner/dashboard" element={<OwnerRoute><OwnerDashboard /></OwnerRoute>} />
            <Route path="/owner/create-farm" element={<OwnerRoute><CreateFarm /></OwnerRoute>} />
            <Route path="/owner/edit-farm/:id" element={<OwnerRoute><EditFarm /></OwnerRoute>} />
            <Route path="/owner/add-user" element={<OwnerRoute><AddUser /></OwnerRoute>} />
            <Route path="/owner/manage-users" element={<OwnerRoute><ManageUsers /></OwnerRoute>} />
            <Route path="/owner/profile" element={<OwnerRoute><OwnerProfile /></OwnerRoute>} />
            <Route path="/owner/farms" element={<OwnerRoute><ManageFarms /></OwnerRoute>} />
            <Route path="/owner/reports/:type" element={<OwnerRoute><OwnerActivityLogs /></OwnerRoute>} />
            <Route path="/owner/consolidated-reports" element={<OwnerRoute><OwnerConsolidatedReports /></OwnerRoute>} />
            <Route path="/owner/activity/:type" element={<OwnerRoute><RecordActivity /></OwnerRoute>} />

            {/* USER PORTAL */}
            <Route path="/user/dashboard" element={<UserRoute><UserDashboard /></UserRoute>} />
            <Route path="/user/profile" element={<UserRoute><UserProfile /></UserRoute>} />
            <Route path="/user/daily-report" element={<UserRoute><UserDailyReport /></UserRoute>} />
            <Route path="/user/activity/:type" element={<UserRoute><RecordActivity /></UserRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
