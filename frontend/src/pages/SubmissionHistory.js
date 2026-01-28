import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  Table,
  Tag,
  Button,
  Modal,
  Switch,
  Select,
  Space,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import api, { downloadLog } from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { DownloadOutlined } from "@ant-design/icons";

const { Option } = Select;

const SubmissionHistory = ({
  problemId = null,
  limit = 100,
  showPagination = true,
}) => {
  const { user } = useContext(AuthContext);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [currentLog, setCurrentLog] = useState("");
  const [currentSubmissionId, setCurrentSubmissionId] = useState(null);

  // Filters
  const [viewAll, setViewAll] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterProblemId, setFilterProblemId] = useState(problemId);
  const [problems, setProblems] = useState([]);

  // Fetch problems list if we are in global view
  useEffect(() => {
    if (!problemId) {
      const fetchProblems = async () => {
        try {
          const res = await api.get("/problems/");
          setProblems(res.data);
        } catch (error) {
          console.error("Failed to fetch problems", error);
        }
      };
      fetchProblems();
    } else {
      setFilterProblemId(problemId);
    }
  }, [problemId]);

  const fetchSubmissions = useCallback(async () => {
    try {
      const params = {
        limit,
        all_users: viewAll,
        sort_order: sortOrder,
      };
      if (filterProblemId) params.problem_id = filterProblemId;

      const res = await api.get("/submissions/", { params });
      setSubmissions(res.data);
    } catch (error) {
      console.error(error);
    }
  }, [limit, viewAll, sortOrder, filterProblemId]);

  useEffect(() => {
    setLoading(true);
    fetchSubmissions().finally(() => setLoading(false));

    const interval = setInterval(fetchSubmissions, 5000);
    return () => clearInterval(interval);
  }, [fetchSubmissions]);

  const showLog = async (id) => {
    setCurrentSubmissionId(id);
    try {
      const res = await api.get(`/submissions/${id}/log`);
      setCurrentLog(res.data.log);
      setLogModalOpen(true);
    } catch (error) {
      setCurrentLog("Log unavailable.");
      setLogModalOpen(true);
    }
  };

  const handleDownloadLog = async (id) => {
    try {
      await downloadLog(id);
    } catch (error) {
      message.error("Failed to download log.");
    }
  };

  const cancelSubmission = async (id) => {
    try {
      await api.post(`/submissions/${id}/cancel`);
      message.success("Submission cancelled");
      fetchSubmissions();
    } catch (error) {
      const detail =
        error.response?.data?.detail || "Failed to cancel submission";
      message.error(detail);
    }
  };

  const columns = [
    {
      title: "Time",
      dataIndex: "submitted_at",
      key: "submitted_at",
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        let color = "default";
        if (status === "Success") color = "green";
        if (status === "Failed") color = "red";
        if (status === "Running") color = "blue";
        if (status === "Pending") color = "orange";
        if (status === "Cancelled") color = "grey";
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      render: (score) => (score !== null ? score : "-"),
    },
    {
      title: "Performance",
      dataIndex: "performance",
      key: "performance",
      render: (performance, record) => {
        if (!record.problem?.performance_enabled) {
          return "N/A";
        }
        if (performance !== null && performance !== undefined) {
          const unit = record.problem?.performance_unit || "";
          return `${performance} ${unit}`;
        }
        return "-";
      },
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => {
        const canCancel =
          record.status === "Pending" &&
          (user?.id === record.user_id || user?.is_admin);

        return (
          <Space size="small">
            <Button size="small" onClick={() => showLog(record.id)}>
              View Log
            </Button>
            <Tooltip title="Download Log">
              <Button 
                size="small" 
                icon={<DownloadOutlined />} 
                onClick={() => handleDownloadLog(record.id)} 
              />
            </Tooltip>
            {canCancel && (
              <Popconfirm
                title="Cancel this submission?"
                description="This action cannot be undone."
                onConfirm={() => cancelSubmission(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button size="small" danger>
                  Cancel
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // Dynamically add columns based on view/context
  if (viewAll) {
    columns.unshift({
      title: "User",
      dataIndex: ["user", "username"],
      key: "user",
    });
  }

  if (!problemId) {
    // Find where to insert Problem column.
    // If User column exists (index 0), Problem goes at 1?
    // Standard: User, Problem, Time, Status...
    // If no User: Problem, Time, Status...
    const insertIndex = viewAll ? 1 : 0;
    columns.splice(insertIndex, 0, {
      title: "Problem",
      dataIndex: "problem_id",
      key: "problem_id",
      render: (pid) => {
        const p = problems.find((p) => p.id === pid);
        return p ? p.title : pid;
      },
    });
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Switch
            checkedChildren="All Users"
            unCheckedChildren="My Submissions"
            checked={viewAll}
            onChange={setViewAll}
          />

          <Select
            defaultValue="desc"
            style={{ width: 140 }}
            onChange={setSortOrder}
            value={sortOrder}
          >
            <Option value="desc">Newest First</Option>
            <Option value="asc">Oldest First</Option>
            <Option value="score_desc">Highest Score</Option>
            <Option value="score_asc">Lowest Score</Option>
          </Select>

          {!problemId && (
            <Select
              style={{ width: 200 }}
              placeholder="Filter by Problem"
              allowClear
              onChange={setFilterProblemId}
              value={filterProblemId}
            >
              {problems.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.title}
                </Option>
              ))}
            </Select>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={submissions}
        rowKey="id"
        loading={loading}
        pagination={showPagination ? { pageSize: 10 } : false}
      />

      <Modal
        title={<span style={{ fontFamily: "'Orbitron', sans-serif" }}>EXECUTION LOG</span>}
        open={logModalOpen}
        onOk={() => setLogModalOpen(false)}
        onCancel={() => setLogModalOpen(false)}
        width={800}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={() => handleDownloadLog(currentSubmissionId)} style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)', background: 'transparent' }}>
            DOWNLOAD LOG
          </Button>,
          <Button key="close" onClick={() => setLogModalOpen(false)}>
            CLOSE
          </Button>,
        ]}
      >
        <pre
          style={{
            maxHeight: "400px",
            overflow: "auto",
            backgroundColor: "#0d1117",
            padding: "15px",
            color: "#e0e0e0",
            fontFamily: "'Share Tech Mono', monospace",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
          }}
        >
          {currentLog}
        </pre>
      </Modal>
    </>
  );
};

export default SubmissionHistory;
