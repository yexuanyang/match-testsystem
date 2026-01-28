import React, { useState, useContext } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const { Title } = Typography;

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('Login successful');
      navigate('/');
    } catch (error) {
      message.error('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Card style={{ width: 400, border: '1px solid var(--primary-color)', boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <Title level={3} style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '2px', color: 'var(--primary-color)', margin: 0 }}>SYSTEM ACCESS</Title>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '5px' }}>Identify yourself</div>
        </div>
        <Form
          name="normal_login"
          className="login-form"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please input your Username!' }]}
          >
            <Input prefix={<UserOutlined style={{ color: 'var(--primary-color)' }} />} placeholder="Username" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'var(--border-color)', color: 'white' }} />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your Password!' }]}
          >
            <Input
              prefix={<LockOutlined style={{ color: 'var(--primary-color)' }} />}
              type="password"
              placeholder="Password"
              style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'var(--border-color)', color: 'white' }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-form-button" block loading={loading} style={{ height: '45px', fontSize: '1rem' }}>
              INITIATE SESSION
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
