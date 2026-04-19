import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Tag,
  Button,
  Space,
  Popconfirm,
  message,
  Switch,
  Input,
  Select,
  Card,
  Row,
  Col,
} from "antd";
import {
  DeleteOutlined,
  StopOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import api from "../../services/api";

const { Option } = Select;

const SubmissionManagement = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // Filters
  const [showAll, setShowAll] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterSubmissionId, setFilterSubmissionId] = useState("");
  const [filterProblemId, setFilterProblemId] = useState("");

  const fetchSubmissions = useCallback(async () => {
    // Avoid spinner on poll if we already have data, unless explicit refresh could be useful,
    // but here we just keep it simple.
    // If we are changing filters, we might want to show loading, but for polling we don't.
    // Let's rely on the calling context or just set loading if submissions is empty.
    // Actually, for filter changes, we want immediate feedback.

    try {
      const params = {
        all_users: showAll,
        sort_order: sortOrder,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };

      if (filterSubmissionId) {
        params.submission_id = filterSubmissionId;
      }
      if (filterProblemId) {
        params.problem_id = filterProblemId;
      }

      const res = await api.get("/submissions/", { params });
      setSubmissions(res.data);
      const total = Number.parseInt(res.headers["x-total-count"] || "0", 10);
      setTotalCount(Number.isNaN(total) ? res.data.length : total);
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch submissions");
    }
  }, [showAll, sortOrder, filterSubmissionId, filterProblemId, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [showAll, sortOrder, filterSubmissionId, filterProblemId]);

  useEffect(() => {
    setLoading(true);
    fetchSubmissions().finally(() => setLoading(false));

    const interval = setInterval(fetchSubmissions, 5000);
    return () => clearInterval(interval);
  }, [fetchSubmissions]);

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
    { title: "ID", dataIndex: "id", key: "id", width: 60 },
    { title: "User ID", dataIndex: "user_id", key: "user_id", width: 80 },
    {
      title: "Problem ID",
      dataIndex: "problem_id",
      key: "problem_id",
      width: 80,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        let color = "default";
        if (status === "Success") color = "green";
        if (status === "Failed" || status === "Cancelled") color = "red";
        if (status === "Running") color = "blue";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      render: (score) => (score !== null && score !== undefined ? score : "-"),
    },
    {
      title: "Submitted",
      dataIndex: "submitted_at",
      key: "submitted_at",
      render: (t) => new Date(t).toLocaleString(),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {(record.status === "Running" || record.status === "Pending") && (
            <Popconfirm
              title="Cancel this submission?"
              onConfirm={() => handleStop(record.id)}
            >
              <Button icon={<StopOutlined />} danger size="small">
                Cancel
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="Delete record?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <Switch
              checkedChildren="All Submissions"
              unCheckedChildren="My Submissions"
              checked={showAll}
              onChange={setShowAll}
            />
          </Col>
          <Col>
            <Select
              value={sortOrder}
              onChange={setSortOrder}
              style={{ width: 140 }}
            >
              <Option value="desc">Newest First</Option>
              <Option value="asc">Oldest First</Option>
              <Option value="score_desc">Highest Score</Option>
              <Option value="score_asc">Lowest Score</Option>
            </Select>
          </Col>
          <Col>
            <Input
              placeholder="Submission ID"
              value={filterSubmissionId}
              onChange={(e) => setFilterSubmissionId(e.target.value)}
              style={{ width: 150 }}
              allowClear
            />
          </Col>
          <Col>
            <Input
              placeholder="Problem ID"
              value={filterProblemId}
              onChange={(e) => setFilterProblemId(e.target.value)}
              style={{ width: 150 }}
              allowClear
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={fetchSubmissions}>
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      <Table
        dataSource={submissions}
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
    </div>
  );
};

export default SubmissionManagement;
