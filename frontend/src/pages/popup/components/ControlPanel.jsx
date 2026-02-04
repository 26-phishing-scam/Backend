import React from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';

export default function ControlPanel({ status, setStatus, onReset }) {
  return (
    <div className="control-grid">
      <button
        onClick={() => setStatus('running')}
        className={`control-btn ${status === 'running' ? 'btn-active-on' : ''}`}
      >
        <div className="icon-wrapper bg-emerald-500">
          <Play className="w-4 h-4 fill-current" />
        </div>
        <span className="text-[10px] font-bold text-emerald-800">시작</span>
      </button>

      <button
        onClick={() => setStatus('paused')}
        className={`control-btn ${status === 'paused' ? 'btn-paused-on' : ''}`}
      >
        <div className="icon-wrapper bg-amber-400">
          <Pause className="w-4 h-4 fill-current" />
        </div>
        <span className="text-[10px] font-bold text-amber-800">정지</span>
      </button>

      <button
        onClick={() => setStatus('stopped')}
        className={`control-btn ${status === 'stopped' ? 'btn-stopped-on' : ''}`}
      >
        <div className="icon-wrapper bg-rose-500">
          <Square className="w-4 h-4 fill-current" />
        </div>
        <span className="text-[10px] font-bold text-rose-800">종료</span>
      </button>

      <button onClick={onReset} className="control-btn group">
        <div className="icon-wrapper bg-slate-400 group-hover:bg-slate-500 transition-colors">
          <RotateCcw className="w-4 h-4" />
        </div>
        <span className="text-[10px] font-bold text-slate-600">초기화</span>
      </button>
    </div>
  );
}
