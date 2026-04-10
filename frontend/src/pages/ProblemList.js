import React, { useState, useEffect } from 'react';
import { Table, Button, Typography, Space } from 'antd';
import { Link } from 'react-router-dom';
import api from '../services/api';

const { Title } = Typography;

const ProblemList = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchProblems();
  }, [currentPage]);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const params = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      const res = await api.get('/problems/', { params });
      setProblems(res.data);
      const total = Number.parseInt(res.headers['x-total-count'] || '0', 10);
      setTotalCount(Number.isNaN(total) ? res.data.length : total);
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
      title: 'Deadline',
      dataIndex: 'deadline',
      key: 'deadline',
      render: (text) => (text ? new Date(text).toLocaleString() : 'Permanent'),
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
        <Title level={2} style={{ margin: 0 }}>Problems</Title>
      </div>
      <Table
        columns={columns}
        dataSource={problems}
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
    </div>
  );
};

export default ProblemList;
