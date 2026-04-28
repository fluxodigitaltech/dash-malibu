import { Toaster as Sonner } from "@/components/ui/sonner";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PactoDataProvider } from "./contexts/PactoDataContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Overview from "./pages/Overview";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardLayout from "./components/layouts/DashboardLayout";
import { WhatsAppIntegration } from "./pages/WhatsAppIntegration";
import Settings from "./pages/Settings";
import MessageSender from "./pages/MessageSender";
import PactoOperations from "./pages/PactoOperations";
import UserManagement from "./pages/UserManagement";
import TVDashboard from "./pages/TVDashboard";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    errorElement: <NotFound />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    // TV/Kiosk mode — public, no auth required, shows live dashboard data
    path: "/tv",
    element: <TVDashboard />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: "/overview",
            element: <Overview />,
          },
          {
            path: "/dashboard",
            element: <Dashboard />,
          },
          {
            path: "/whatsapp",
            element: <WhatsAppIntegration />,
          },
          {
            path: "/message-sender",
            element: <MessageSender />,
          },
          {
            path: "/pacto-operations",
            element: <PactoOperations />,
          },
          {
            path: "/settings",
            element: <Settings />,
          },
          {
            path: "/users",
            element: <UserManagement />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

const App = () => (
  <AuthProvider>
    <PactoDataProvider>
      <Sonner />
      <RouterProvider router={router} />
    </PactoDataProvider>
  </AuthProvider>
);

export default App;