import React, { useState, useEffect } from 'react';
import { Table, Button, Typography, Space } from 'antd';
import { Link } from 'react-router-dom';
import api from '../services/api';

const { Title } = Typography;

const ProblemList = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/problems/');
      setProblems(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => <Link to={`/problem/${record.id}`}>{text}</Link>,
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Link to={`/problem/${record.id}`}>
            <Button type="primary">Solve</Button>
          </Link>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Title level={2} style={{ margin: 0 }}>AVAILABLE CHALLENGES</Title>
        <div style={{ color: 'var(--primary-color)', fontFamily: "'Orbitron', sans-serif" }}>
          STATUS: ONLINE
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={problems}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
};

export default ProblemList;
