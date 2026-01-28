import React from 'react';
import { Tabs } from 'antd';
import UserManagement from './UserManagement';
import ProblemManagement from './ProblemManagement';
import SubmissionManagement from './SubmissionManagement';

const AdminPanel = () => {
  const items = [
    {
      key: '1',
      label: 'User Management',
      children: <UserManagement />,
    },
    {
      key: '2',
      label: 'Problem Management',
      children: <ProblemManagement />,
    },
    {
      key: '3',
      label: 'Submission Management',
      children: <SubmissionManagement />,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>Admin Control Panel</h2>
      <Tabs defaultActiveKey="1" items={items} destroyInactiveTabPane />
    </div>
  );
};

export default AdminPanel;
