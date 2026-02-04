// 파일 위치: src/report_entry.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // 스타일 파일 (없으면 이 줄 삭제)

// 우리가 열심히 만든 Report 페이지 컴포넌트 불러오기
// (경로가 src/pages/report/Report.jsx 라고 가정)
import Report from './pages/report/Report';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Report />
  </React.StrictMode>,
);
