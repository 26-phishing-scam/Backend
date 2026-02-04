# 피싱/스캠 예방 모노레포

이 저장소는 백엔드(FastAPI)와 프론트엔드(React/Vite)를 함께 포함합니다.

## 구조
- `backend/` 백엔드 API (FastAPI)
- `frontend/` 프론트엔드 (React/Vite)
- `backend/schemas/` 이벤트 스키마 (JSON Schema)

## 백엔드
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.app.main:app --reload
```

### CORS
루트 `.env`의 `CORS_ORIGINS`로 허용 origin을 설정합니다(쉼표로 구분).
예: `CORS_ORIGINS=http://localhost:5173`
크롬 확장을 사용할 경우 `chrome-extension://<extension-id>`를 추가하세요.
개발 환경(`APP_ENV=local|dev|development`)에서는 모든 크롬 확장 origin이 자동 허용됩니다.

## 프론트엔드
```powershell
cd frontend
npm install
npm run build
npm run dev
```

### API Base URL
아래 예시를 참고해 `frontend/.env`를 생성하세요:
```
VITE_API_BASE_URL=http://localhost:8000
VITE_USE_SAMPLE=true
```

### 크롬 확장 (빌드 & 로드)
```powershell
.\scripts\build-extension.ps1
```
크롬에서:
1. `chrome://extensions` 열기
2. 개발자 모드 활성화
3. "압축 해제된 확장 프로그램을 로드" 클릭
4. `frontend/dist` 선택 (React UI)

구버전 UI(React 아님)는 `frontend/extension`에서 로드할 수 있지만,
이 레포의 기본은 React UI입니다.

### 이벤트 스키마
배치 분석 페이로드 형식은 `backend/schemas/events.schema.json`를 참고하세요.

## 동시 실행 (개발용)
```powershell
.\scripts\dev.ps1
```

## 참고
- 프론트 빌드 결과물은 `frontend/dist`입니다.
- 환경 변수 파일은 git에서 제외됩니다.
- 패키징/제출 시 `.git/`, `venv/`, `.venv/`를 제외하세요.
