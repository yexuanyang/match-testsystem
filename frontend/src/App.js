import React, { useContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import { AuthProvider, AuthContext } from "./context/AuthContext";
import MainLayout from "./components/MainLayout";
import Login from "./pages/Login";
import ProblemList from "./pages/ProblemList";
import ProblemDetail from "./pages/ProblemDetail";
import SubmissionHistory from "./pages/SubmissionHistory";
import AdminPanel from "./pages/admin/AdminPanel";
import "antd/dist/reset.css";

const PrivateRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? children : <Navigate to="/login" />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<ProblemList />} />
        <Route path="problem/:id" element={<ProblemDetail />} />
        <Route
          path="history"
          element={
            <div style={{ padding: 20 }}>
              <SubmissionHistory />
            </div>
          }
        />
        <Route path="admin" element={<AdminPanel />} />
      </Route>
    </Routes>
  );
};

const App = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#2f81f7",
          colorBgBase: "#0d1117",
          colorBgContainer: "#161b22",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          borderRadius: 6,
          colorLink: "#2f81f7",
        },
        components: {
          Layout: {
            headerBg: "#161b22",
            bodyBg: "#0d1117",
          },
          Card: {
            colorBorderSecondary: "#30363d",
          },
        },
      }}
    >
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
