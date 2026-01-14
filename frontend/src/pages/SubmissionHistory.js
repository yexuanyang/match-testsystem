import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Typography } from 'antd';
import api from '../services/api';

const { Text } = Typography;

const SubmissionHistory = ({ problemId = null, limit = 100, showPagination = true }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [currentLog, setCurrentLog] = useState('');

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 5000); // Poll every 5s for updates
    return () => clearInterval(interval);
  }, [problemId]);

  const fetchSubmissions = async () => {
    // Only set loading on first load to avoid flickering
    if (submissions.length === 0) setLoading(true);
    try {
      const params = { limit };
      if (problemId) params.problem_id = problemId;

      const res = await api.get('/submissions/', { params });
      setSubmissions(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const showLog = async (id) => {
    try {
      const res = await api.get(`/submissions/${id}/log`);
      setCurrentLog(res.data.log);
      setLogModalOpen(true);
    } catch (error) {
        // Handle error silently or show message
        setCurrentLog("Log unavailable.");
        setLogModalOpen(true);
    }
  };

  const columns = [
    {
      title: 'Time',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        if (status === 'Success') color = 'green';
        if (status === 'Failed') color = 'red';
        if (status === 'Running') color = 'blue';
        if (status === 'Pending') color = 'orange';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (score) => score !== null ? score : '-',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button size="small" onClick={() => showLog(record.id)}>
          View Log
        </Button>
      ),
    },
  ];

  if (!problemId) {
      // If not filtered by problem, show Problem ID column
      columns.splice(1, 0, {
          title: 'Problem ID',
          dataIndex: 'problem_id',
          key: 'problem_id',
      });
  }

  return (
    <>
      <Table
        columns={columns}
        dataSource={submissions}
        rowKey="id"
        loading={loading}
        pagination={showPagination ? { pageSize: 10 } : false}
      />
      <Modal
        title="Execution Log"
        open={logModalOpen}
        onOk={() => setLogModalOpen(false)}
        onCancel={() => setLogModalOpen(false)}
        width={800}
        footer={[
            <Button key="close" onClick={() => setLogModalOpen(false)}>
                Close
            </Button>
        ]}
      >
        <pre style={{ maxHeight: '400px', overflow: 'auto', backgroundColor: '#f5f5f5', padding: '10px' }}>
          {currentLog}
        </pre>
      </Modal>
    </>
  );
};

export default SubmissionHistory;
