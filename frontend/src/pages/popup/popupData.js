// 초기 도메인 데이터
export const initialDomains = [];

// 초기 이벤트 데이터
export const initialEvents = [];

// 상태별 UI 정보 반환 함수
export const getStatusInfo = (status) => {
  switch (status) {
    case 'running':
      return {
        label: '실행 중',
        className: 'status-active',
        text: '실시간 감시가 동작 중입니다.',
      };
    case 'paused':
      return {
        label: '일시 중지',
        className: 'status-paused',
        text: '감시가 잠시 중지되었습니다.',
      };
    case 'stopped':
      return {
        label: '종료됨',
        className: 'status-stopped',
        text: '감시가 종료되었습니다.',
      };
    default:
      return {
        label: '-',
        className: 'status-default',
        text: '',
      };
  }
};
