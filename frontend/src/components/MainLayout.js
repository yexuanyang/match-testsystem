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
  const {
    token: { colorBgContainer },
  } = theme.useToken();

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
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2rem', marginRight: '40px' }}>
          Test System
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0 }}
        />
        {user && (
          <div style={{ color: 'white' }}>
            <span style={{ marginRight: '15px' }}>Hi, {user.username}</span>
            <Button type="primary" danger icon={<LogoutOutlined />} onClick={handleLogout} size="small">
              Logout
            </Button>
          </div>
        )}
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content" style={{ marginTop: '24px', padding: 24, minHeight: 380, background: colorBgContainer }}>
          <Outlet />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Test System ©2024</Footer>
    </Layout>
  );
};

export default MainLayout;
