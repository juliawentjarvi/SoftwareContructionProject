# SoftwareContructionProject
This project explores two different approaches to AI-assisted software development: vibe coding and SDD. The goal is to develop the same application using both approaches.

## Bear care
Our application is an interactive virtual pet that encourages users to build healthy daily habits through caring for a bear. The main screen displays the pet, its health status, food and energy levels, a settings menu and other interactive objects. The user can customize the application to suit their preferences. Users can interact with the pet and play games as long as the pet has enough energy. The application allows users to log meals manually or through reminders.

## Team members:
Saga Malmio, Julia Wentjärvi, Eevi Nikkilä

## Technologies

### Frontend
- Expo SDK 58
- React Native 0.88
- React 19
- TypeScript
- react-native-svg
- Expo SecureStore
- Expo Image Picker
- Expo Image Manipulator
- Expo Notifications

### Backend
- Node.js
- Express 5
- TypeScript
- MongoDB Atlas
- Mongoose
- Zod
- bcryptjs
- jsonwebtoken(JWT)
- Helmet
- express-rate-limit
- Brevo/SMTP

### Testing
- Vitest 5
- Supertest
- Puppeteer Core
- Custom load-test script

### AI-assisted Development
- ChatGPT
- GitHub Copilot
- Spec Kit 1.2.3
- Claude

## How to install and run the application
You need Node.js (LTS) and a free MongoDB Atlas database. Test on a phone with the **Expo Go** app, or in a desktop browser.

1. **API.** In `server/`: copy `.env.example` to `.env`, set `MONGODB_URI` (your Atlas connection string) and a random
   `JWT_SECRET` of at least 32 characters, then run `npm install` and `npm run dev`. Check `http://localhost:3000/health` shows
   `{"status":"ok"}`. More detail and the API list: [`server/README.md`](server/README.md).
2. **App.** In `mobile/`: run `npm install` and `npx expo start --lan`.
   - **Browser:** press `w`, or open `http://localhost:8081`.
   - **Phone:** put the phone on the same Wi-Fi (or share the computer's hotspot), open Expo Go and scan the QR code.
   - The app finds the API on the computer that serves it, so nothing needs configuring when the network changes. If it can't
     connect, check the computer's firewall allows Node.js and that the network doesn't isolate devices; Connection settings on the
     sign-in screen can override the address.
3. Create an account. There is no "forgot password" yet, so remember or write down the password.

## Vibe coding and SDD
The versions for vibe coding and SDD are in different branches. Vibe coding is in branch1 and SDD is in review-baseline.
