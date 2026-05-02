import React, { createContext, useContext, useReducer, useCallback } from 'react';
import * as api from './client.js';

const AppContext = createContext(null);

// ─── Initial State ────────────────────────────────────────────────────────────

const init = {
  page: 'dashboard',          // dashboard | workflow | agent-studio | agents | templates
  activeProjectId: null,
  activeStory: null,          // { id, key, summary, description, source }
  activeRunId: null,
  projects: [],
  projectsLoaded: false,
  runs: {},                   // { [projectId]: [...] }
  templates: [],
  templatesLoaded: false,
  serverStatus: null,
  loading: {},
  errors: {},
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'SET_PAGE':
      return { ...state, page: action.page };

    case 'SET_PROJECT': {
      const proj = state.projects.find(p => p.id === action.id) || null;
      return {
        ...state,
        activeProjectId: action.id,
        activeStory: null,
        activeRunId: null,
        page: action.page || (proj ? 'workflow' : 'dashboard'),
      };
    }

    case 'SET_STORY':
      return { ...state, activeStory: action.story };

    case 'SET_RUN':
      return { ...state, activeRunId: action.runId };

    case 'SET_SERVER':
      return { ...state, serverStatus: action.status };

    case 'SET_PROJECTS':
      return { ...state, projects: action.projects, projectsLoaded: true };

    case 'ADD_PROJECT':
      return { ...state, projects: [action.project, ...state.projects] };

    case 'UPDATE_PROJECT': {
      const projects = state.projects.map(p =>
        p.id === action.project.id ? action.project : p
      );
      return { ...state, projects };
    }

    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.id),
        activeProjectId: state.activeProjectId === action.id ? null : state.activeProjectId,
        page: state.activeProjectId === action.id ? 'dashboard' : state.page,
      };

    case 'SET_RUNS': {
      const runs = { ...state.runs, [action.projectId]: action.runs };
      return { ...state, runs };
    }

    case 'ADD_RUN': {
      const existing = state.runs[action.projectId] || [];
      const runs = {
        ...state.runs,
        [action.projectId]: [action.run, ...existing.filter(r => r.id !== action.run.id)]
      };
      return { ...state, runs };
    }

    case 'SET_TEMPLATES':
      return { ...state, templates: action.templates, templatesLoaded: true };

    case 'UPDATE_TEMPLATE': {
      const templates = state.templates.map(t =>
        t.type === action.templateType
          ? { ...t, [action.file === 'system-prompt' ? 'systemPrompt' : 'instructions']: action.content }
          : t
      );
      return { ...state, templates };
    }

    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };

    case 'SET_ERROR':
      return { ...state, errors: { ...state.errors, [action.key]: action.message } };

    default:
      return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, init);

  const actions = {
    // ── Navigation ───────────────────────────────────────────────────────────

    setPage: (page) => dispatch({ type: 'SET_PAGE', page }),

    setProject: (id, page) => dispatch({ type: 'SET_PROJECT', id, page }),

    setStory: (story) => dispatch({ type: 'SET_STORY', story }),

    openAgentStudio: (story) => {
      dispatch({ type: 'SET_STORY', story });
      dispatch({ type: 'SET_PAGE', page: 'agent-studio' });
    },

    goBack: () => {
      if (state.page === 'agent-studio') {
        dispatch({ type: 'SET_PAGE', page: 'workflow' });
      } else if (state.page === 'workflow' || state.page === 'agents') {
        dispatch({ type: 'SET_PAGE', page: 'workflow' });
      } else {
        dispatch({ type: 'SET_PAGE', page: 'dashboard' });
        dispatch({ type: 'SET_PROJECT', id: null, page: 'dashboard' });
      }
    },

    // ── Server ───────────────────────────────────────────────────────────────

    checkServer: async () => {
      try {
        const s = await api.getStatus();
        dispatch({ type: 'SET_SERVER', status: { ok: true, ...s } });
      } catch {
        dispatch({ type: 'SET_SERVER', status: { ok: false } });
      }
    },

    // ── Projects ─────────────────────────────────────────────────────────────

    loadProjects: async () => {
      dispatch({ type: 'SET_LOADING', key: 'projects', value: true });
      try {
        const projects = await api.getProjects();
        dispatch({ type: 'SET_PROJECTS', projects });
        dispatch({ type: 'SET_SERVER', status: { ok: true } });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', key: 'projects', message: err.message });
        dispatch({ type: 'SET_SERVER', status: { ok: false } });
      } finally {
        dispatch({ type: 'SET_LOADING', key: 'projects', value: false });
      }
    },

    createProject: async (data) => {
      const project = await api.createProject(data);
      dispatch({ type: 'ADD_PROJECT', project });
      return project;
    },

    updateProject: async (id, data) => {
      const project = await api.updateProject(id, data);
      dispatch({ type: 'UPDATE_PROJECT', project });
      return project;
    },

    deleteProject: async (id) => {
      await api.deleteProject(id);
      dispatch({ type: 'DELETE_PROJECT', id });
    },

    // ── Agents ───────────────────────────────────────────────────────────────

    addAgent: async (projectId, data) => {
      const { project } = await api.addAgent(projectId, data);
      dispatch({ type: 'UPDATE_PROJECT', project });
      return project;
    },

    updateAgent: async (projectId, agentId, data) => {
      const { project } = await api.updateAgent(projectId, agentId, data);
      dispatch({ type: 'UPDATE_PROJECT', project });
      return project;
    },

    deleteAgent: async (projectId, agentId) => {
      const { project } = await api.deleteAgent(projectId, agentId);
      dispatch({ type: 'UPDATE_PROJECT', project });
      return project;
    },

    // ── Stories ──────────────────────────────────────────────────────────────

    addStory: async (projectId, story) => {
      const project = await api.addStory(projectId, story);
      dispatch({ type: 'UPDATE_PROJECT', project });
      return project;
    },

    deleteStory: async (projectId, storyId) => {
      const project = await api.deleteStory(projectId, storyId);
      dispatch({ type: 'UPDATE_PROJECT', project });
      return project;
    },

    // ── Templates ────────────────────────────────────────────────────────────

    loadTemplates: async () => {
      dispatch({ type: 'SET_LOADING', key: 'templates', value: true });
      try {
        const templates = await api.getTemplates();
        dispatch({ type: 'SET_TEMPLATES', templates });
      } finally {
        dispatch({ type: 'SET_LOADING', key: 'templates', value: false });
      }
    },

    saveTemplate: async (type, file, content) => {
      await api.updateTemplate(type, file, content);
      dispatch({ type: 'UPDATE_TEMPLATE', templateType: type, file, content });
    },

    // ── Runs ─────────────────────────────────────────────────────────────────

    loadRuns: async (projectId) => {
      dispatch({ type: 'SET_LOADING', key: 'runs', value: true });
      try {
        const runs = await api.getRuns(projectId);
        dispatch({ type: 'SET_RUNS', projectId, runs });
      } finally {
        dispatch({ type: 'SET_LOADING', key: 'runs', value: false });
      }
    },

    addRun: (projectId, run) => {
      dispatch({ type: 'ADD_RUN', projectId, run });
    },
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
