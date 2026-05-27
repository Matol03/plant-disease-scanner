# 🌿 Plant Disease Scanner

A mobile-first PWA (Progressive Web App) that uses AI to diagnose plant diseases from leaf photos. Works 100% offline after install.

## Features
- 📷 Camera capture or photo upload
- 🔬 On-device AI inference (EfficientNet via TensorFlow.js)
- 🌾 38 PlantVillage disease categories
- 💾 Field log with IndexedDB persistence
- 📱 PWA — installable, works offline
- 🌍 Optimised for Central Asian farmers (Kazakh/Russian crop focus)

## Tech Stack
- **Frontend:** React + TypeScript + Vite
- **AI/ML:** TensorFlow.js + EfficientNet-B0
- **Storage:** IndexedDB (idb)
- **PWA:** vite-plugin-pwa + Workbox
- **Design:** Earthy field-notebook aesthetic; 56px touch targets; WCAG AAA contrast

## Project Structure
```
src/
  components/     # UI components (CaptureButton, DiagnosisCard, etc.)
  pages/          # App screens (Home, Camera, Processing, Result, FieldLog)
  hooks/          # useModelInference (TF.js model loading + inference)
  data/           # diseaseData.ts — 38 disease classes with treatment steps
  utils/          # db.ts — IndexedDB CRUD operations
  types/          # TypeScript interfaces
```

## Quick Start
```bash
npm install
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production build
```

## Adding the Real AI Model
1. Train or download EfficientNet-B0 on PlantVillage dataset
2. Convert to TF.js format: `tensorflowjs_converter --input_format=keras model.h5 public/model/`
3. The app will automatically detect and use `public/model/model.json`

Without the model file, the app runs in **demo mode** with realistic simulated predictions.

## Deployment
Deploy the `dist/` folder to any static host:
- **Vercel:** `npx vercel --prod`
- **Netlify:** Drag `dist/` to netlify.com/drop
- **GitHub Pages:** Configure workflow to deploy `dist/`

## Business Model
- **Free tier:** Unlimited scans, local field log
- **Pro ($9/month):** Detailed analytics, PDF export, Kazakh/Russian language, agronomist chat

## Target Market
Small-scale farmers in Kazakhstan, Uzbekistan, Kyrgyzstan — a $2.4B agricultural market with high smartphone penetration and limited access to agronomists.
