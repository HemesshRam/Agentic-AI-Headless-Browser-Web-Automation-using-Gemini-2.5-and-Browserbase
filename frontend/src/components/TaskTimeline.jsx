import React from 'react';
import { CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import './TaskTimeline.css';

const TaskTimeline = ({ tasks = [] }) => {
  return (
    <div className="task-timeline glass-panel">
      <h3 className="timeline-header">TASK TIMELINE</h3>
      <div className="timeline-content">
        {tasks.map((task, idx) => (
          <div key={task.id} className={`timeline-item ${task.status}`}>
            <div className="timeline-icon">
              {task.status === 'completed' && <CheckCircle2 size={18} className="text-green" />}
              {task.status === 'running' && <PlayCircle size={18} className="text-cyan pulse" />}
              {task.status === 'pending' && <Circle size={18} className="text-gray" />}
            </div>
            <div className="timeline-text">
              <span className="step-label">Step {idx + 1}</span>
              <p>{task.text}</p>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="timeline-empty">No tasks running</div>
        )}
      </div>
    </div>
  );
};

export default TaskTimeline;
