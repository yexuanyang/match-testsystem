import React, { useContext } from 'react';
import { Layout, Menu, Button, theme } from 'antd';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogoutOutlined, UnorderedListOutlined, HistoryOutlined, UserOutlined } from '@ant-design/icons';

const { Header, Content, Footer } = Layout;

const MainLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // We rely on global.css and ConfigProvider for colors now
  // but we can still access tokens if needed.

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/',
      icon: <UnorderedListOutlined />,
      label: <Link to="/">Problem List</Link>,
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: <Link to="/history">My Submissions</Link>,
    },
  ];

  if (user?.is_admin) {
    menuItems.push({
      key: '/admin',
      icon: <UserOutlined />,
      label: <Link to="/admin">Admin Panel</Link>,
    });
  }

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 50px' }}>
        <div style={{ 
          color: '#00f0ff', 
          fontWeight: 'bold', 
          fontSize: '1.5rem', 
          marginRight: '40px',
          fontFamily: "'Orbitron', sans-serif",
          textShadow: '0 0 10px rgba(0, 240, 255, 0.5)',
          letterSpacing: '2px'
        }}>
          LEADERBOARD
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
        />
        {user && (
          <div style={{ color: 'var(--text-primary)' }}>
            <span style={{ marginRight: '15px', fontFamily: "'Rajdhani', sans-serif", fontWeight: 500 }}>Hi, {user.username}</span>
            <Button type="primary" danger icon={<LogoutOutlined />} onClick={handleLogout} size="small" style={{ borderRadius: '0' }}>
              Logout
            </Button>
          </div>
        )}
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content" style={{ marginTop: '24px', padding: 24, minHeight: 380 }}>
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center', background: 'transparent', color: 'var(--text-secondary)' }}>
        Test System Leaderboard ©2026 | Designed for Performance
      </Footer>
    </Layout>
  );
};

export default MainLayout;
