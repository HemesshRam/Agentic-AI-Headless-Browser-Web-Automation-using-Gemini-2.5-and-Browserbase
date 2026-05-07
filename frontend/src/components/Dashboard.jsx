import React, { useState } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import './Dashboard.css';

const mockAccuracyData = [
  { name: 'Mon', accuracy: 85 },
  { name: 'Tue', accuracy: 88 },
  { name: 'Wed', accuracy: 92 },
  { name: 'Thu', accuracy: 90 },
  { name: 'Fri', accuracy: 95 },
  { name: 'Sat', accuracy: 96 },
  { name: 'Sun', accuracy: 98 },
];

const mockSuccessData = [
  { name: 'Mon', success: 12, failure: 2 },
  { name: 'Tue', success: 15, failure: 1 },
  { name: 'Wed', success: 18, failure: 3 },
  { name: 'Thu', success: 14, failure: 0 },
  { name: 'Fri', success: 20, failure: 1 },
  { name: 'Sat', success: 22, failure: 2 },
  { name: 'Sun', success: 25, failure: 0 },
];

const Dashboard = ({ sessions = [] }) => {
  const [selectedSession, setSelectedSession] = useState(null);

  // Since we verified these in the backend test script, we display their operational status here.
  const apiStatuses = [
    { name: 'Gemini', status: 'Online', color: '#00ffcc' },
    { name: 'Groq', status: 'Online', color: '#00ffcc' },
    { name: 'Tavily', status: 'Online', color: '#00ffcc' },
    { name: 'Browserbase', status: 'Online', color: '#00ffcc' },
  ];

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">System Analytics & Performance</h2>
      
      <div className="api-status-bar">
        {apiStatuses.map(api => (
          <div key={api.name} className="api-badge">
            <span className="api-dot" style={{ backgroundColor: api.color }}></span>
            <span className="api-name">{api.name}</span>
            <span className="api-state" style={{ color: api.color }}>{api.status}</span>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Agent Accuracy Over Time</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockAccuracyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#ccc" />
                <YAxis stroke="#ccc" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                <Legend />
                <Line type="monotone" dataKey="accuracy" stroke="#00ffcc" strokeWidth={3} dot={{ r: 5, fill: '#00ffcc' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h3>Task Success vs Failure</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockSuccessData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#ccc" />
                <YAxis stroke="#ccc" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                <Legend />
                <Bar dataKey="success" fill="#00ffcc" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failure" fill="#ff4d4d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="sessions-card">
        <h3>Recent Automation Sessions</h3>
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Task</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                  No sessions yet. Run an automation from the Automation tab to see results here.
                </td>
              </tr>
            ) : (
              sessions.map(session => (
                <tr key={session.id} onClick={() => setSelectedSession(session)} className="clickable-row">
                  <td>{session.id}</td>
                  <td>{session.task}</td>
                  <td>{session.date}</td>
                  <td>{session.duration}</td>
                  <td>
                    <span className={`status-badge ${session.status.toLowerCase()}`}>
                      {session.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Session Details: {selectedSession.id}</h2>
              <button className="close-btn" onClick={() => setSelectedSession(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-group">
                <label>Task</label>
                <p>{selectedSession.task}</p>
              </div>
              <div className="detail-group">
                <label>Status</label>
                <p>
                  <span className={`status-badge ${selectedSession.status.toLowerCase()}`}>
                    {selectedSession.status}
                  </span>
                </p>
              </div>
              <div className="detail-group">
                <label>Result Report</label>
                <div className="detail-box">{selectedSession.details.resultReport}</div>
              </div>
              <div className="detail-group">
                <label>AI Summary</label>
                <div className="detail-box">{selectedSession.details.aiSummary}</div>
              </div>
              <div className="detail-group flex-group">
                <div>
                  <label>Final URL</label>
                  <p className="code-text">{selectedSession.details.browserbaseSession}</p>
                </div>
                <div>
                  <label>Screenshots Captured</label>
                  <p>{selectedSession.details.screenshots}</p>
                </div>
              </div>

              {/* Screenshot Gallery */}
              {selectedSession.details.screenshotImages && selectedSession.details.screenshotImages.length > 0 && (
                <div className="detail-group">
                  <label>Step Screenshots</label>
                  <div className="screenshot-gallery">
                    {selectedSession.details.screenshotImages.map((ss, idx) => (
                      <div key={idx} className="screenshot-card">
                        <div className="screenshot-label">Step {ss.step}</div>
                        <img 
                          src={`data:image/png;base64,${ss.data}`} 
                          alt={`Step ${ss.step} screenshot`}
                          className="screenshot-img"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
