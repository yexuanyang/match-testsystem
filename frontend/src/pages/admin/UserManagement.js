import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Upload, message, Space, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import api from '../../services/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (error) {
      message.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (values) => {
    try {
      if (editingUser) {
        // Reset Password Logic
        await api.put(`/users/${editingUser.id}/password`, {
            old_password: "", // Not needed for admin reset
            new_password: values.password
        });
        message.success("Password updated");
      } else {
        // Create User
        await api.post('/users/', values);
        message.success("User created");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
        console.error(error);
      message.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success("User deleted");
      fetchUsers();
    } catch (error) {
      message.error("Failed to delete user");
    }
  };

  const handleBatchUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/users/batch', formData);
      message.success(`Created: ${res.data.created}. Errors: ${res.data.errors.length}`);
      if (res.data.errors.length > 0) {
          console.error(res.data.errors);
      }
      fetchUsers();
    } catch (error) {
      message.error("Batch upload failed");
    }
    return false;
  };

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openResetPasswordModal = (user) => {
    setEditingUser(user);
    form.resetFields();
    setIsModalOpen(true);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Is Admin', dataIndex: 'is_admin', key: 'is_admin', render: (val) => val ? "Yes" : "No" },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<KeyOutlined />} size="small" onClick={() => openResetPasswordModal(record)}>Reset Pwd</Button>
          <Popconfirm title="Delete user?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" disabled={record.is_admin} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={openCreateModal}>Add User</Button>
        <Upload beforeUpload={handleBatchUpload} showUploadList={false} accept=".csv">
          <Button icon={<UploadOutlined />}>Batch Import (CSV)</Button>
        </Upload>
      </Space>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} />

      <Modal
        title={editingUser ? `Reset Password for ${editingUser.username}` : "Create New User"}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
          {!editingUser && (
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="password" label={editingUser ? "New Password" : "Password"} rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          {!editingUser && (
              <Form.Item name="is_admin" label="Is Admin" valuePropName="checked">
                  <Input type="checkbox" />
              </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
