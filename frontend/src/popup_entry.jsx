import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './pages/popup/Popup'; // 경로가 맞는지 확인하세요!
import './index.css'; // 스타일 적용

ReactDOM.createRoot(document.getElementById('popup-root')).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
