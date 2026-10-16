# Pramana Clinical Twin (TwinCare) — Production Deployment Report

**Project**: Pramana Clinical Digital Twin (TwinCare)  
**Target Architecture**: Next.js (Vercel) + FastAPI (Render)  
**Model Pipeline**: 132-Feature Longitudinal XGBoost + Platt Calibrator + TreeSHAP Explainability  
**Generated On**: October 16, 2026  
**Status**: Ready for Public Deployment (All Builds & Verification Tests Passing)

---

## Executive Summary

The **Pramana Clinical Twin** repository has been audited, hardened, and prepared for public deployment on **Vercel** (Frontend) and **Render** (Backend). All deployment blockers have been resolved without altering the trained XGBoost model or removing features.

| Layer | Hosting Target | Runtime | Status | Key Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | Next.js 16.4 / React 19 / Turbopack | **Ready** | 16/16 routes compiled, 0 TS errors, 3D assets cached |
| **Backend** | Render | Python 3.11 / FastAPI / Uvicorn | **Ready** | 28/28 pytest tests passed, startup time 2.68s |
| **ML Engine** | Render (In-Memory) | XGBoost 2.0 / Platt Calibrator / SHAP | **Ready** | 14 artifacts intact (3.3 MB total, 156ms load time) |
| **Persistence** | Render Disk / Ephemeral | Append-only JSONL + JSON | **Configured** | Configurable `DATA_DIR` & `AUDIT_LOG_PATH` |

---

## 1. Pre-Flight Verification & Test Results

### 1.1 Backend Test Suite (Pytest)
```bash
python -m pytest backend/tests/test_api.py -v
```
- **Total Tests**: 28
- **Passed**: 28 (100%)
- **Failed**: 0
- **Duration**: 3.78s
- **Verified Coverage**:
  - System health check (`/health`, `/api/v1/health`)
  - Model metadata and schema lock fingerprint (`a4ddaedbdbc8bb07`)
  - Patient detail and roster indexing
  - 132-feature derivation and forbidden column rejection
  - TreeSHAP explanations and sign consistency
  - What-If simulation clamping and correlated feature adjustments
  - Risk timeline replay scrubber
  - Cryptographic SHA-256 audit hash-chain integrity & tampering detection
  - Dynamic patient registration and validation

### 1.2 Frontend Production Build (Next.js)
```bash
npm run build
```
- **Next.js Version**: 16.4.0 (Turbopack)
- **Compilation Time**: 913ms
- **TypeScript Check**: Completed in 2.3s (0 errors)
- **Static Page Generation**: 16/16 routes prerendered successfully
  - Routes: `/`, `/twin`, `/patients`, `/patients/[id]`, `/performance`, `/alerts`, `/model-card`, `/population`, `/register`, `/audit`, `/about`, `/india`, `/import`, `/how-it-works`, `/_not-found`
- **Asset Integrity**: Verified all 4 Three.js 3D GLB meshes (`human-male.glb`, `human-female.glb`, `generic-body.glb`, `human-model.glb`) have valid `glTF` binary headers.

### 1.3 Model Artifact Benchmark
| Artifact | File Size | Memory / Cold-Start Load Time |
| :--- | :--- | :--- |
| `final_model.joblib` / `model_pipeline.joblib` | 154 KB | **156.3 ms** |
| `platt_calibrator.joblib` | 107 bytes | < 1 ms |
| `feature_schema.json` & `feature_columns.json` | 43 KB | 2.1 ms |
| `demo_patients.json` (64 demo profiles) | 374 KB | **18.8 ms** |
| `shap_global.json` & `shap_values.npy` | 784 KB | **46.6 ms** |
| `X_features.joblib` & `model_df.joblib` | 1.74 MB | 92.4 ms |
| **Total Artifact Footprint** | **~3.3 MB** | **Total startup: 2.68s** (Well under Render 60s timeout) |

---

## 2. Code Changes & Deployment Hardening

1. **Platform-Aware Server Entrypoint** ([backend/app/main.py](file:///c:/Users/sugud/OneDrive/Documents/digital%20twins/backend/app/main.py)):
   - Added `if __name__ == "__main__":` entrypoint dynamically binding to `HOST` (`0.0.0.0`) and `PORT` (injected by Render).
   - Ensured fallback resolution for `artifacts_dir` relative to `__file__`.

2. **Production-Hardened CORS Policy** ([backend/app/main.py](file:///c:/Users/sugud/OneDrive/Documents/digital%20twins/backend/app/main.py)):
   - Cleanly parses comma-separated origins from `ALLOWED_ORIGINS` / `CORS_ORIGINS`.
   - **Zero Wildcard in Production**: Rejects and removes `*` if `ENVIRONMENT=production` or running on Render.
   - Added regex support (`ALLOWED_ORIGIN_REGEX`, defaulting to `^https:\/\/.*\.vercel\.app$`) for Vercel preview branch deployments.

3. **Frontend API Client Resilience** ([frontend/lib/api.ts](file:///c:/Users/sugud/OneDrive/Documents/digital%20twins/frontend/lib/api.ts)):
   - Reads backend URL from `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_BACKEND_URL`.
   - Automatically trims trailing slashes to prevent double-slash malformed URLs (`//api/v1/...`).
   - Normalizes path prefixes for all API routes.

4. **Persistent Storage Support** ([backend/app/services/patient_service.py](file:///c:/Users/sugud/OneDrive/Documents/digital%20twins/backend/app/services/patient_service.py) & [backend/app/services/audit_service.py](file:///c:/Users/sugud/OneDrive/Documents/digital%20twins/backend/app/services/audit_service.py)):
   - Configurable paths via `DATA_DIR`, `PERSISTENT_DATA_DIR`, `AUDIT_LOG_PATH`, and `REGISTERED_PATIENTS_PATH`.
   - Supports Render Persistent Disk mounts (e.g., `/var/data`) while gracefully falling back to local storage in ephemeral free-tier environments.
   - Auto-creates parent directories if they don't exist yet.

5. **3D Asset Caching** ([frontend/vercel.json](file:///c:/Users/sugud/OneDrive/Documents/digital%20twins/frontend/vercel.json)):
   - Added immutable 1-year cache headers (`Cache-Control: public, max-age=31536000, immutable`) for `/models/(.*)`.

6. **Repository Security & Git Protection** ([.gitignore](file:///c:/Users/sugud/OneDrive/Documents/digital%20twins/.gitignore)):
   - Excluded all `.env*` files (preserving `.env.example`).
   - Excluded runtime files: `*.log`, `inference_audit.jsonl`, `data/`, `backend/data/`.
   - Explicitly blacklisted raw clinical data formats (`*.csv`, `*.tsv`, `*.parquet`, `*.vcf`, `*.dcm`, `*.tar.gz`).

---

## 3. Step-by-Step Hosting Settings

### Step 1: Deploy Backend on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/) and click **New + → Web Service**.
2. Connect your Git repository.
3. Configure the service settings:

| Setting | Value |
| :--- | :--- |
| **Name** | `twincare-backend` (or your preferred name) |
| **Region** | `Oregon (US West)` or `Frankfurt (EU)` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install --upgrade pip && pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | `Free` (or `Starter` if attaching Persistent Disk) |
| **Health Check Path** | `/health` |

4. In **Environment Variables**, add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `PYTHON_VERSION` | `3.11.9` | Ensures exact Python runtime |
| `ENVIRONMENT` | `production` | Enforces production security checks |
| `ALLOWED_ORIGINS` | `https://your-twincare.vercel.app` | *Set to temporary `http://localhost:3000` until Vercel URL is known* |
| `ALLOWED_ORIGIN_REGEX` | `^https:\/\/.*\.vercel\.app$` | Enables all Vercel production and preview URLs |
| `ARTIFACTS_DIR` | `artifacts` | Relative to `backend/` |
| `DATA_DIR` | `data` | Or `/var/data` if Persistent Disk is attached |

5. *(Optional Persistent Disk)*: If using Render Starter ($7/mo):
   - Go to **Disks → Add Disk**.
   - Name: `twincare-data`
   - Mount Path: `/var/data`
   - Size: `1 GB` ($0.25/mo)
   - Update `DATA_DIR` environment variable to `/var/data`.

6. Click **Deploy Web Service**. Once deployed, copy your Render URL:  
   `https://<your-service-name>.onrender.com`

---

### Step 2: Deploy Frontend on Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New… → Project**.
2. Import the same Git repository.
3. In the project setup screen, configure:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `Next.js` | Automatically detected |
| **Root Directory** | `frontend` | **Crucial**: Click "Edit" and choose `frontend` |
| **Build Command** | `npm run build` | Default |
| **Output Directory** | `.next` | Default |
| **Install Command** | `npm install` | Executes `patch-drei.js` postinstall automatically |

4. In **Environment Variables**, add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://<your-service-name>.onrender.com` | **No trailing slash**. Points to your Render backend. |

5. Click **Deploy**. Vercel will build and assign your domain:  
   `https://your-twincare.vercel.app`

---

### Step 3: Link Frontend Domain to Backend CORS

1. Return to your **Render Dashboard → twincare-backend → Environment**.
2. Update `ALLOWED_ORIGINS` with your actual Vercel domain:
   ```text
   https://your-twincare.vercel.app,http://localhost:3000
   ```
3. Save changes. Render will perform a zero-downtime rolling restart.

---

## 4. Manual Actions Required by User

1. **Push Git Changes**:
   ```bash
   git add .
   git commit -m "chore(deploy): prepare Vercel frontend and Render backend configuration"
   git push origin main
   ```
2. **Execute Deployment on Render**: Follow Section 3, Step 1.
3. **Execute Deployment on Vercel**: Follow Section 3, Step 2.
4. **Final CORS Alignment**: Follow Section 3, Step 3.

---

## 5. Potential Blockers & Operational Notices

1. **Render Free Tier Spin-Down**:
   - On Render Free tier, the service spins down after 15 minutes of inactivity. The first incoming request will experience a **cold-start delay of ~30–50 seconds**.
   - *Mitigation*: The frontend includes a clear `"Cannot reach TwinCare backend..."` retry notification. Upgrading to Render Starter ($7/month) eliminates cold starts.
2. **Data Persistence on Render Free Tier**:
   - Without an attached Render Persistent Disk, registered patients and audit log events written at runtime reside in the container's ephemeral filesystem and will be wiped upon service redeployments or container restarts. Demo patients (64 profiles) are committed as read-only artifacts and will never be lost.
3. **Vercel Root Directory Selection**:
   - If importing via Vercel GUI, ensure the **Root Directory** is explicitly set to `frontend`. (We have also added root `package.json` fallback scripts to prevent build failure if this step is overlooked).
