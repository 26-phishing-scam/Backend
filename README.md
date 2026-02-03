# Backend
2026 피싱, 스캠 예방 서비스 개발 공모전 백엔드















# 가상환경 생성
python -m venv .venv

# 가상환경 활성화
.venv\Scripts\Activate.ps1

# 의존성 설치
pip install -r requirements.txt

# 서버 실행
uvicorn app.main:app --reload
