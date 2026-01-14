import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Popconfirm, message } from 'antd';
import { DeleteOutlined, StopOutlined } from '@ant-design/icons';
import api from '../../services/api';

const SubmissionManagement = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSubmissions = async () => {
    // Avoid spinner on poll
    if (submissions.length === 0) setLoading(true);
    try {
      const res = await api.get('/submissions/');
      setSubmissions(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async (id) => {
      try {
          await api.post(`/submissions/${id}/cancel`);
          message.success("Task cancellation requested");
          fetchSubmissions();
      } catch (error) {
          message.error("Failed to cancel task");
      }
  };

  const handleDelete = async (id) => {
      try {
          await api.delete(`/submissions/${id}`);
          message.success("Submission deleted");
          fetchSubmissions();
      } catch (error) {
          message.error("Failed to delete submission");
      }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'User ID', dataIndex: 'user_id', key: 'user_id', width: 80 },
    { title: 'Problem ID', dataIndex: 'problem_id', key: 'problem_id', width: 80 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        if (status === 'Success') color = 'green';
        if (status === 'Failed' || status === 'Cancelled') color = 'red';
        if (status === 'Running') color = 'blue';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    { title: 'Submitted', dataIndex: 'submitted_at', key: 'submitted_at', render: t => new Date(t).toLocaleString() },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'Running' && (
             <Popconfirm title="Stop this task?" onConfirm={() => handleStop(record.id)}>
                <Button icon={<StopOutlined />} danger size="small">Stop</Button>
             </Popconfirm>
          )}
          <Popconfirm title="Delete record?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Table
        dataSource={submissions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
    />
  );
};

export default SubmissionManagement;
