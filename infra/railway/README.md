# Railway Deployment

Deploy both services (web + api) on Railway.

## Setup

1. Create a new Railway project
2. Add two services from the same repo:

### Web Service (Next.js)
- **Root Directory**: `apps/web`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Port**: `3000`

### API Service (FastAPI)
- **Root Directory**: `services/api`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Environment Variables

Set these on the API service:

| Variable | Value |
|----------|-------|
| `B2_APPLICATION_KEY_ID` | Your B2 key ID |
| `B2_APPLICATION_KEY` | Your B2 application key |
| `B2_BUCKET_NAME` | Your bucket name |
| `B2_REGION` | Your bucket region (drives the S3 endpoint), e.g. `us-west-004` |
| `B2_PUBLIC_URL_BASE` | (optional) public base URL for shareable object links |
| `ROBOFLOW_API_KEY` | (optional) only needed for Roboflow Universe / hosted models; the default `rfdetr-base` runs keyless |
| `API_CORS_ORIGINS` | Your web service URL (e.g., `https://web-production-xxx.up.railway.app`) |

> Running the build pipeline needs the heavy CV stack. Use a build command of
> `pip install -r requirements.txt -r requirements-ml.txt`. `ffmpeg` is bundled
> via `imageio-ffmpeg` (no system package needed); the default detector weights
> auto-download on first build.

Set this on the Web service:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your API service URL (e.g., `https://api-production-xxx.up.railway.app`) |
