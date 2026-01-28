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
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 50px', borderBottom: '1px solid #30363d' }}>
        <div style={{ 
          color: '#e6edf3', 
          fontWeight: '600', 
          fontSize: '1.2rem', 
          marginRight: '40px',
          letterSpacing: '-0.5px'
        }}>
          Leaderboard
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none', background: 'transparent' }}
        />
        {user && (
          <div style={{ color: 'var(--text-primary)' }}>
            <span style={{ marginRight: '15px', fontWeight: 500 }}>{user.username}</span>
            <Button type="text" danger icon={<LogoutOutlined />} onClick={handleLogout} size="small">
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
        Test System ©2026
      </Footer>
    </Layout>
  );
};

export default MainLayout;
