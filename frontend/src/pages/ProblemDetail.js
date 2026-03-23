import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Upload,
  Button,
  message,
  Form,
  Divider,
  Tabs,
  List,
  Space,
} from "antd";
import {
  UploadOutlined,
  FileZipOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  PaperClipOutlined,
  UpOutlined,
  DownOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

import SubmissionHistory from "./SubmissionHistory";

const { Title, Paragraph } = Typography;

const ProblemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(true);

  useEffect(() => {
    fetchProblem();
  }, [id]);

  const fetchProblem = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/problems/${id}`);
      setProblem(res.data);
    } catch (error) {
      if (error.response?.status === 404) {
        message.error("Problem not found or no longer visible.");
      } else {
        message.error("Failed to load problem");
      }
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    if (!canSubmit) {
      message.error("This problem is no longer open for submissions.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append("problem_id", id);

    if (values.answer && values.answer[0]) {
      formData.append("answer_file", values.answer[0].originFileObj);
    }

    if (values.report && values.report[0]) {
      formData.append("report_file", values.report[0].originFileObj);
    }

    try {
      await api.post("/submissions/", formData);
      message.success("Submission received! It is now in the queue.");
      // Refresh logic could go here or navigate to history
      navigate("/history");
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Submission failed.";
      message.error(errorMsg, 5);
    } finally {
      setSubmitting(false);
    }
  };

  const normFile = (e) => {
    if (Array.isArray(e)) {
      return e;
    }
    return e?.fileList;
  };

  const downloadAttachment = async (filename) => {
    try {
      const response = await api.get(
        `/problems/${id}/attachments/${filename}`,
        { responseType: "blob" },
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error("Failed to download attachment");
    }
  };

  const getAttachments = () => {
    if (!problem.attachments) return [];
    try {
      return JSON.parse(problem.attachments);
    } catch {
      return [];
    }
  };

  if (!problem) return <div>Loading...</div>;

  const attachments = getAttachments();
  const deadline = problem.deadline ? new Date(problem.deadline) : null;
  const isExpired = deadline ? new Date() >= deadline : false;
  const canSubmit = !isExpired || user?.is_admin;

  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Problem ID: {problem.id}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Deadline: {deadline ? deadline.toLocaleString() : "Permanent"}
        </div>
        <Title level={2} style={{ margin: 0 }}>{problem.title}</Title>
      </div>

      <div style={{ display: "flex", gap: "20px", flexDirection: "column" }}>
        <Card
          title="Problem Description"
          extra={
            <Button
              type="text"
              icon={descriptionExpanded ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
            >
              {descriptionExpanded ? "Collapse" : "Expand"}
            </Button>
          }
        >
          {descriptionExpanded && (
            <>
              {/* In a real app, description might be fetched from a markdown file URL */}
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeRaw, rehypeKatex]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {problem.description || "No description provided."}
                </ReactMarkdown>
              </div>

              {attachments.length > 0 && (
                <>
                  <Divider />
                  <div style={{ marginTop: 16 }}>
                    <Typography.Title level={5} style={{ marginBottom: 12 }}>
                      <PaperClipOutlined /> Attachments
                    </Typography.Title>
                    <List
                      size="small"
                      bordered
                      dataSource={attachments}
                      renderItem={(item) => (
                        <List.Item
                          actions={[
                            <Button
                              type="link"
                              icon={<DownloadOutlined />}
                              onClick={() => downloadAttachment(item.filename)}
                            >
                              Download
                            </Button>,
                          ]}
                        >
                          <Space>
                            <PaperClipOutlined />
                            <span>{item.filename}</span>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </Card>

        <Card title="Submit Solution">
          {!canSubmit && (
            <Paragraph type="danger">
              This problem has passed its deadline and is no longer open for submissions.
            </Paragraph>
          )}
          <Form name="submission_form" onFinish={onFinish} layout="vertical">
            <Form.Item
              name="answer"
              label="Answer File (ZIP)"
              valuePropName="fileList"
              getValueFromEvent={normFile}
              rules={[
                {
                  required: true,
                  message: "Please upload your answer zip file",
                },
              ]}
            >
              <Upload beforeUpload={() => false} maxCount={1} accept=".zip">
                <Button icon={<FileZipOutlined />}>Select ZIP File</Button>
              </Upload>
            </Form.Item>

            <Form.Item
              name="report"
              label="Report (PDF/DOC) - Optional"
              valuePropName="fileList"
              getValueFromEvent={normFile}
            >
              <Upload
                beforeUpload={() => false}
                maxCount={1}
                accept=".pdf,.doc,.docx"
              >
                <Button icon={<FilePdfOutlined />}>Select Report</Button>
              </Upload>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                disabled={!canSubmit}
                icon={<UploadOutlined />}
              >
                Submit
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card title="Recent Submissions">
          <SubmissionHistory problemId={id} limit={5} showPagination={false} />
        </Card>
      </div>
    </div>
  );
};

export default ProblemDetail;
