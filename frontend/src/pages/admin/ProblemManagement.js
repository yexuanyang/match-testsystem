import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Space, Popconfirm, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import api from '../../services/api';

const ProblemManagement = () => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [description, setDescription] = useState("");
  const [form] = Form.useForm();

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/problems/');
      setProblems(res.data);
    } catch (error) {
      message.error("Failed to fetch problems");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (values) => {
    const data = { ...values, description };
    try {
      if (editingProblem) {
        await api.put(`/problems/${editingProblem.id}`, data);
        message.success("Problem updated");
      } else {
        await api.post('/problems/', data);
        message.success("Problem created");
      }
      setIsModalOpen(false);
      fetchProblems();
    } catch (error) {
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

  const openEditModal = (problem) => {
    setEditingProblem(problem);
    setDescription(problem.description || "");
    form.setFieldsValue(problem);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingProblem(null);
    setDescription("");
    form.resetFields();
    setIsModalOpen(true);
  };

  // Image Upload Handler for SimpleMDE
  const imageUploadOptions = useMemo(() => {
    return {
      uploadImage: true,
      imageUploadFunction: (file, onSuccess, onError) => {
          const formData = new FormData();
          formData.append('image', file);
          api.post('/utils/upload-image', formData)
             .then(res => {
                 onSuccess(res.data.url);
             })
             .catch(err => {
                 onError("Upload failed");
             });
      },
    };
  }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Docker Image', dataIndex: 'docker_image', key: 'docker_image' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEditModal(record)}>Edit</Button>
          <Popconfirm title="Delete problem?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ marginBottom: 16 }}>
        Add Problem
      </Button>

      <Table dataSource={problems} columns={columns} rowKey="id" loading={loading} />

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
          <Form.Item name="docker_image" label="Docker Image" rules={[{ required: true }]}>
            <Input placeholder="e.g. python:3.9-slim" />
          </Form.Item>
          <Form.Item name="test_command" label="Test Command" rules={[{ required: true }]}>
            <Input placeholder="e.g. python test.py /input/submission.zip" />
          </Form.Item>
          <Form.Item label="Description (Markdown supported)">
            <SimpleMDE
                value={description}
                onChange={setDescription}
                options={imageUploadOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProblemManagement;
