import React, { useContext, useState } from 'react';
import { Layout, Menu, Button, Dropdown, Modal, Form, Input, message, theme } from 'antd';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogoutOutlined, UnorderedListOutlined, HistoryOutlined, UserOutlined, KeyOutlined, DownOutlined } from '@ant-design/icons';
import { changePassword } from '../services/api';

const { Header, Content, Footer } = Layout;

const MainLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  // We rely on global.css and ConfigProvider for colors now
  // but we can still access tokens if needed.

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = async (values) => {
    setLoading(true);
    try {
      await changePassword(values.old_password, values.new_password);
      message.success('密码修改成功');
      setPasswordModalOpen(false);
      passwordForm.resetFields();
    } catch (error) {
      const detail = error.response?.data?.detail || '密码修改失败';
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const userMenuItems = [
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: 'Change Password',
      onClick: () => setPasswordModalOpen(true),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

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
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
            <Button type="text" style={{ color: 'var(--text-primary)' }}>
              <span style={{ fontWeight: 500 }}>{user.username}</span> <DownOutlined />
            </Button>
          </Dropdown>
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

      <Modal
        title="Change Password"
        open={passwordModalOpen}
        onCancel={() => { setPasswordModalOpen(false); passwordForm.resetFields(); }}
        footer={null}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item
            name="old_password"
            label="Current Password"
            rules={[{ required: true, message: 'Please input your current password' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[{ required: true, message: 'Please input your new password' }, { min: 4, message: 'Password must be at least 4 characters' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Confirm New Password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Change Password
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default MainLayout;
