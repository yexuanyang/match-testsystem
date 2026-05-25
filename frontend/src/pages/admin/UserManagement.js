import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Upload, message, Space, Popconfirm, Switch } from 'antd';
import { UploadOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import api, { downloadUserProblemScores } from '../../services/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [includeAdminScores, setIncludeAdminScores] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      const res = await api.get('/users/', { params });
      setUsers(res.data);
      const total = Number.parseInt(res.headers['x-total-count'] || '0', 10);
      setTotalCount(Number.isNaN(total) ? res.data.length : total);
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
      message.error(error.response?.data?.detail || "Failed to delete user");
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

  const handleExportScores = async () => {
    setExporting(true);
    try {
      await downloadUserProblemScores(includeAdminScores);
      message.success('Scores exported');
    } catch (error) {
      message.error(error.response?.data?.detail || 'Export failed');
    } finally {
      setExporting(false);
    }
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
        <Space>
          <span>Include Admin</span>
          <Switch checked={includeAdminScores} onChange={setIncludeAdminScores} />
        </Space>
        <Button loading={exporting} onClick={handleExportScores}>Export Scores (CSV)</Button>
      </Space>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize,
          total: totalCount,
          onChange: (page) => setCurrentPage(page),
          showSizeChanger: false,
        }}
      />

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
