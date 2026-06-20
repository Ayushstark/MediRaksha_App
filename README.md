# MediRaksha App

MediRaksha is a healthcare app built with Expo React Native and an Express/PostgreSQL backend. It supports patient and doctor accounts, appointment slot publishing and booking, nearby hospital discovery, bed booking, medical reports, doctor-patient workflows, and AI-assisted health utilities.

## Project Structure

```text
.
├── Backend/      # Express API server and PostgreSQL integration
└── Frontend/     # Expo React Native app
```

## Main Features

- Patient and doctor authentication
- Doctor discovery and appointment booking
- Doctor slot publishing and meeting management
- Shared appointment persistence with the website database schema
- Nearby hospital search and hospital details
- Hospital partner registration and bed booking
- Medical report upload, sharing, and doctor-side access
- AI assistant, symptom classification, and report analysis support

## Prerequisites

- Node.js 18 or newer
- npm
- PostgreSQL database, local or hosted
- Expo Go app or an Android/iOS emulator
- Optional API keys:
  - Geoapify keys for hospital/location features
  - Groq API key for AI assistant/report analysis

## Backend Setup

1. Open the backend folder:

   ```bash
   cd Backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the backend environment file:

   ```bash
   copy .env.example .env
   ```

4. Fill `Backend/.env`:

   ```env
   PORT=3000
   DB_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
   JWT_SECRET=your-long-random-secret
   FRONTEND_URL=http://localhost:8081
   GROQ_API_KEY=
   GROQ_CHAT_MODEL=llama-3.1-8b-instant
   ```

5. Start the API:

   ```bash
   npm run dev
   ```

   The API runs at:

   ```text
   http://localhost:3000/api
   ```

## Frontend Setup

1. Open the frontend folder:

   ```bash
   cd Frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the frontend environment file:

   ```bash
   copy .env.example .env
   ```

4. Fill `Frontend/.env`:

   ```env
   EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api
   EXPO_PUBLIC_GEOAPIFY_PLACES_KEY=
   EXPO_PUBLIC_GEOAPIFY_ROUTING_KEY=
   EXPO_PUBLIC_GEOAPIFY_MAPS_KEY=
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
   EXPO_PUBLIC_GROQ_API_KEY=
   EXPO_PUBLIC_HUGGINGFACE_TOKEN=
   ```

   For Android emulator, the app can also fall back to `http://10.0.2.2:3000/api`.

5. Start Expo:

   ```bash
   npm start
   ```

6. Open the app using Expo Go, Android emulator, iOS simulator, or web:

   ```bash
   npm run android
   npm run ios
   npm run web
   ```

## Useful Commands

Backend:

```bash
cd Backend
npm run check
npm run dev
npm start
```

Frontend:

```bash
cd Frontend
npm start
npm run lint
npm run android
npm run web
```

## Persistence Notes

The app backend is aligned with the website database design for shared persistence. Appointment booking, doctor slots, hospital records, reports, and bed bookings are stored in the shared PostgreSQL tables so changes made from the app can be visible to the website and vice versa when both point to the same database.

Key shared tables include:

- `"User"`
- `"Doctor"`
- `"Slot"`
- `"Appointment"`
- `"Report"`
- `"Hospital"`
- `"BedBooking"`

## Environment Safety

Do not commit real `.env` files or production secrets. Use the `.env.example` files as templates only.

## Troubleshooting

- If the app cannot reach the backend, confirm `EXPO_PUBLIC_BACKEND_URL` points to the reachable API URL.
- If running on a physical phone, use your computer's LAN IP instead of `localhost`.
- If PostgreSQL SSL is required, keep `sslmode=require` in `DB_URL`.
- If AI features fail, confirm `GROQ_API_KEY` is set in `Backend/.env`.
