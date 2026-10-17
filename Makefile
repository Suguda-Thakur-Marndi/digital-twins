.PHONY: all help dev test build docker-up docker-down clean install

all: help

help:
	@echo "VitalTwin — AI-Powered Clinical Digital Twin — Make commands:"
	@echo "  make dev         - Run both backend and frontend concurrently for local development"
	@echo "  make test        - Run backend pytest test suite (26 API & validation tests)"
	@echo "  make build       - Build production Next.js frontend and verify backend artifacts"
	@echo "  make docker-up   - Build and start full stack via docker compose"
	@echo "  make docker-down - Stop docker compose containers"
	@echo "  make install     - Install all Python and Node.js dependencies"
	@echo "  make clean       - Remove cache and temporary build directories"

install:
	@echo "Installing backend dependencies..."
	pip install -r backend/requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

dev:
	@echo "Starting VitalTwin (Backend on :8000, Frontend on :3000)..."
	@echo "Run these in two terminals if not using background runners:"
	@echo "  Terminal 1: cd backend && uvicorn app.main:app --reload --port 8000"
	@echo "  Terminal 2: cd frontend && npm run dev"

test:
	@echo "Running backend test suite..."
	python -m pytest backend/tests/test_api.py -v

build:
	@echo "Validating backend artifacts..."
	python -c "import joblib; m=joblib.load('backend/artifacts/model_pipeline.joblib'); print('Model OK:', type(m))"
	@echo "Building Next.js frontend production bundle..."
	cd frontend && npm run build

docker-up:
	docker compose up --build

docker-down:
	docker compose down

clean:
	@echo "Cleaning cache files..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
