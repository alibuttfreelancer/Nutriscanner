# NutriScanner 🥑📸

NutriScanner is an AI-powered food analysis web app. **Upload a photo or scan a product with your camera** and instantly get:

- 🔥 **Calorie estimate** for the product
- ⚠️ **Harmful ingredients** with short explanations
- 🥗 **A healthier substitute** with reasons and practical tips

The analysis is performed by Google's **Gemini** multimodal AI using structured JSON output.

![NutriScanner](public/logo.png)

## Tech stack

- **React 19** + **Vite**
- **Tailwind CSS 4**
- **Google Gemini API** (`generateContent` with image input + JSON response schema)
- No backend required — the browser talks directly to the Gemini API.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Provide a Gemini API key

Get a free key at <https://aistudio.google.com/app/apikey>, then choose **one** of:

- **Option A — env file:** copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY=your_key`
- **Option B — in-app:** run the app, open the menu (top-right) → **Settings**, and paste your key. It is stored only in your browser's local storage.

You can also override the model via `VITE_GEMINI_MODEL` or the Settings dialog
(default: `gemini-3.5-flash`).

### 3. Run the dev server

```bash
npm run dev
```

Open the printed URL (default <http://localhost:5173>).

### 4. Build for production

```bash
npm run build
npm run preview
```

## Features

- **Upload Image** — pick any product photo from your device
- **Live Scan** — use your device camera (rear camera on mobile) and capture a frame
- **Analyze** — Gemini returns product name, calories, harmful ingredients, and a healthy substitute with tips, validated against a JSON schema
- **Retry with exponential backoff** on transient API failures, and clear error messages for invalid keys or model names
- **Pages:** Home, About Us, Privacy Policy, Terms of Service, and expandable **Healthy Recipes**
- Fully responsive, mobile-first UI

## How it works

1. The selected/captured image is converted to Base64 in the browser.
2. It is sent to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` along with a system instruction ("You are a nutrition and food analysis expert…") and a strict JSON response schema.
3. The parsed result is rendered as cards: calories, harmful ingredients, and a healthy substitute.

> ⚠️ The nutritional analysis is an AI-generated estimate and is not a substitute for professional medical or nutritional advice.

## Project structure

```
├── index.html          # App entry HTML
├── vite.config.js      # Vite + React + Tailwind config
├── public/logo.png     # App logo / favicon
├── src/
│   ├── main.jsx        # React bootstrap
│   ├── index.css       # Tailwind import
│   └── App.jsx         # The entire app (scanner, pages, settings)
└── .env.example        # API key / model configuration template
```

## License

NutriScanner © 2026 — all rights reserved.
