import React from 'react';

export default function ProjectFilter({ projects, value, onChange }) {
  return (
    <select
      className="input"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ minWidth: 200, cursor: 'pointer' }}
    >
      <option value="">— All Projects —</option>
      {projects.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
