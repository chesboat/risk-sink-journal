# Deploy Risk Sink Journal to Vercel

## Step 1: Push to GitHub

1. Go to https://github.com/new and create a new repo called `risk-sink-journal` (private recommended)
2. Open Terminal and run:

```bash
cd ~/Documents/Claude/Projects/Trading\ Risk\ Sink\ and\ Journaling/risk-sink-journal
git init
git add .
git commit -m "Initial commit: Risk Sink Journal v1.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/risk-sink-journal.git
git push -u origin main
```

## Step 2: Deploy on Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New Project"
3. Import your `risk-sink-journal` repo
4. Vercel auto-detects Vite — settings should be:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click "Deploy"
6. Done! Your journal is live at `https://risk-sink-journal.vercel.app`

## Step 3: Custom Domain (Optional)

1. In Vercel project settings → Domains
2. Add your custom domain
3. Follow DNS instructions

## Local Development

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Data

All data is stored in your browser's localStorage. Use the export/import buttons in the sidebar to backup your data as JSON.
