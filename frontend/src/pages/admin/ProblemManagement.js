import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Radio,
  Upload,
  List,
  Tag,
  Switch,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
  PaperClipOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import api from "../../services/api";

const ProblemManagement = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [description, setDescription] = useState("");
  const [testMode, setTestMode] = useState("command");
  const [performanceEnabled, setPerformanceEnabled] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [attachmentFileList, setAttachmentFileList] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const res = await api.get("/problems/");
      setProblems(res.data);
    } catch (error) {
      message.error("Failed to fetch problems");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (values) => {
    // Validation for script mode
    if (testMode === "script") {
      const hasExistingScript =
        editingProblem && editingProblem.test_script_path;
      const hasNewScript = fileList.length > 0;

      if (!hasExistingScript && !hasNewScript) {
        message.error("Please upload a test script");
        return;
      }
    }

    const formData = new FormData();
    formData.append("title", values.title);
    formData.append("docker_image", values.docker_image);
    if (description) formData.append("description", description);
    if (values.submission_map_path)
      formData.append("submission_map_path", values.submission_map_path);
    
    // Add performance fields
    formData.append("performance_enabled", performanceEnabled);
    if (performanceEnabled && values.performance_unit) {
      formData.append("performance_unit", values.performance_unit);
    }

    if (testMode === "command") {
      if (values.test_command)
        formData.append("test_command", values.test_command);
      if (editingProblem) {
        formData.append("clear_script", "true");
      }
    } else {
      if (fileList.length > 0) {
        formData.append(
          "test_script_file",
          fileList[0].originFileObj || fileList[0],
        );
      }
      // If we are in script mode but no new file, we assume keeping old one if editing.
    }

    // Append attachment files
    if (attachmentFileList.length > 0) {
      attachmentFileList.forEach((file) => {
        formData.append("attachment_files", file.originFileObj || file);
      });
    }

    // If editing, send updated existing attachments list
    if (editingProblem) {
      formData.append("existing_attachments", JSON.stringify(existingAttachments));
    }

    try {
      if (editingProblem) {
        await api.put(`/problems/${editingProblem.id}`, formData);
        message.success("Problem updated");
      } else {
        await api.post("/problems/", formData);
        message.success("Problem created");
      }
      setIsModalOpen(false);
      fetchProblems();
    } catch (error) {
      console.error(error);
      message.error("Operation failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/problems/${id}`);
      message.success("Problem deleted");
      fetchProblems();
    } catch (error) {
      message.error("Failed to delete problem");
    }
  };

  const removeExistingAttachment = (filename) => {
    setExistingAttachments((curr) =>
      curr.filter((item) => item.filename !== filename)
    );
  };

  const openEditModal = (problem) => {
    setEditingProblem(problem);
    setDescription(problem.description || "");
    form.setFieldsValue(problem);
    setPerformanceEnabled(problem.performance_enabled || false);

    if (problem.test_script_path) {
      setTestMode("script");
    } else {
      setTestMode("command");
    }
    setFileList([]);
    setAttachmentFileList([]);
    
    // Load existing attachments
    if (problem.attachments) {
      try {
        const attachments = JSON.parse(problem.attachments);
        setExistingAttachments(attachments);
      } catch {
        setExistingAttachments([]);
      }
    } else {
      setExistingAttachments([]);
    }
    
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingProblem(null);
    setDescription("");
    form.resetFields();
    setTestMode("command");
    setPerformanceEnabled(false);
    setFileList([]);
    setAttachmentFileList([]);
    setExistingAttachments([]);
    setIsModalOpen(true);
  };

  // SimpleMDE Options with Image Upload and Preview
  const simpleMdeOptions = useMemo(() => {
    // Configure marked with KaTeX extension
    marked.use(markedKatex({
      throwOnError: false,
      nonStandard: true, // 启用单 $ 的行内公式
    }));
    
    // Configure marked with highlight.js
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.error(err);
          }
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true,
      gfm: true,
      sanitize: false, // 允许 HTML 标签
      smartypants: false,
    });

    return {
      spellChecker: false,
      uploadImage: true,
      imageUploadFunction: (file, onSuccess, onError) => {
        const formData = new FormData();
        formData.append("image", file);
        api
          .post("/utils/upload-image", formData)
          .then((res) => {
            onSuccess(res.data.url);
          })
          .catch((err) => {
            onError("Upload failed");
          });
      },
      insertTexts: {
        link: ["[", "](https://)"],
        image: ["![", "](/uploads/images/)"],  
      },
      previewRender: (plainText) => {
        // Use marked to render markdown with code highlighting
        return marked(plainText);
      },
      toolbar: [
        "bold",
        "italic",
        "heading",
        "|",
        "quote",
        "code",
        "unordered-list",
        "ordered-list",
        "|",
        "link",
        "image",
        "|",
        "preview",
        "side-by-side",
        "fullscreen",
        "|",
        "guide",
      ],
    };
  }, []);

  const uploadProps = {
    onRemove: (file) => {
      setFileList((curr) => {
        const index = curr.indexOf(file);
        const newFileList = curr.slice();
        newFileList.splice(index, 1);
        return newFileList;
      });
    },
    beforeUpload: (file) => {
      setFileList([file]); // Only keep one file
      return false;
    },
    fileList,
  };

  const attachmentUploadProps = {
    onRemove: (file) => {
      setAttachmentFileList((curr) => {
        const index = curr.indexOf(file);
        const newFileList = curr.slice();
        newFileList.splice(index, 1);
        return newFileList;
      });
    },
    beforeUpload: (file) => {
      setAttachmentFileList((curr) => [...curr, file]);
      return false;
    },
    fileList: attachmentFileList,
    multiple: true,
  };

  const columns = [
    { title: "ID", dataIndex: "id", key: "id", width: 60 },
    { title: "Title", dataIndex: "title", key: "title" },
    { title: "Docker Image", dataIndex: "docker_image", key: "docker_image" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEditModal(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete problem?"
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
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={openCreateModal}
        style={{ marginBottom: 16 }}
      >
        Add Problem
      </Button>

      <Table
        dataSource={problems}
        columns={columns}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingProblem ? "Edit Problem" : "Create Problem"}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="docker_image"
            label="Docker Image"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g. python:3.9-slim" />
          </Form.Item>

          <Form.Item label="Test Configuration">
            <Radio.Group
              value={testMode}
              onChange={(e) => setTestMode(e.target.value)}
            >
              <Radio value="command">Run Command</Radio>
              <Radio value="script">Run Script</Radio>
            </Radio.Group>
          </Form.Item>

          {testMode === "command" ? (
            <Form.Item
              name="test_command"
              label="Test Command"
              rules={[{ required: true }]}
            >
              <Input placeholder="e.g. python test.py /input/submission.zip" />
            </Form.Item>
          ) : (
            <Form.Item label="Test Script" required>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>Select Script</Button>
              </Upload>
              {editingProblem?.test_script_path && (
                <div style={{ marginTop: 8, color: "gray" }}>
                  Current script configured. Upload new one to replace.
                </div>
              )}
            </Form.Item>
          )}

          <Form.Item name="submission_map_path" label="Submission Mapping Path">
            <Input placeholder="/input/submission.zip" />
          </Form.Item>

          <Form.Item label="Performance Tracking">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Switch
                checked={performanceEnabled}
                onChange={setPerformanceEnabled}
                checkedChildren="Enabled"
                unCheckedChildren="Disabled"
              />
              {performanceEnabled && (
                <Form.Item
                  name="performance_unit"
                  label="Performance Unit"
                  rules={[{ required: true, message: 'Please input performance unit' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder="e.g., s, ms, kg, MB" style={{ width: '200px' }} />
                </Form.Item>
              )}
            </Space>
          </Form.Item>

          <Form.Item label="Attachments (Optional)">
            {existingAttachments.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  <PaperClipOutlined /> Existing Attachments:
                </div>
                <List
                  size="small"
                  bordered
                  dataSource={existingAttachments}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<CloseCircleOutlined />}
                          onClick={() => removeExistingAttachment(item.filename)}
                        >
                          Remove
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
            )}
            <Upload {...attachmentUploadProps}>
              <Button icon={<UploadOutlined />}>
                {existingAttachments.length > 0 ? "Add More Attachments" : "Upload Attachments"}
              </Button>
            </Upload>
            <div style={{ marginTop: 8, color: "gray", fontSize: "12px" }}>
              Upload patch files, data files, or other materials students may need
            </div>
          </Form.Item>

          <Form.Item label="Description (Markdown supported)">
            <SimpleMDE
              value={description}
              onChange={setDescription}
              options={simpleMdeOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProblemManagement;
