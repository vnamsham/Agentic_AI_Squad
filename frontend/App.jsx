import React, { useEffect } from 'react';
import { AppProvider, useApp } from './AppContext.jsx';
import Nav from './components/Nav.jsx';
import Dashboard from './components/Dashboard.jsx';
import Workflow from './components/Workflow.jsx';
import AgentStudio from './components/AgentStudio.jsx';
import Agents from './components/Agents.jsx';
import Templates from './components/Templates.jsx';

import UsageDashboard from './components/UsageDashboard.jsx';

function AppShell() {
  const { state, actions } = useApp();

  useEffect(() => {
    actions.checkServer();
    actions.loadProjects();
  }, []);

  function renderPage() {
    switch (state.page) {
      case 'workflow':      return <Workflow />;
      case 'agent-studio':  return <AgentStudio />;
      case 'agents':        return <Agents />;
      case 'templates':     return <Templates />;
      default:              return <Dashboard />;
    }
  }

  return (
    <div className="app-shell">
      <Nav />
      <div className="page-content">
        {renderPage()}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
