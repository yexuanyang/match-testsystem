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
          colorPrimary: "#00f0ff",
          colorBgBase: "#050510",
          colorBgContainer: "#1e1e32",
          fontFamily: "'Rajdhani', sans-serif",
          borderRadius: 2,
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
