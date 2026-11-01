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

## Vibe coding and SDD
The versions for vibe coding and SDD are in different branches. 
- Vibe coding: branch1
- SDD: review-baseline.

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


## Project Development

**Modifications**

Modifications where made throughout the project to improve the outcome.
   - Improved the sudoku game by adding validation for incorrect numbers, automatic compleation checks, and progress saving.
   - Refined bear animations and interactions to improve the UX.
   - Updated the reminder functionality and time-zone handling based on rewuirements identified during development.
   - Improved account management, settings, and the daily goal system.
   - Updated the specifications and implementation based on testing results and identified limitations.
     
**Issues**

Some technical challenges were encountered during the development phase:
   - TypeScript configuration: Conflicts between module imports and TS configuration caused errors during development.
   - MongoDB Atlas connection: Connecting the application to MongoDB Atlas caused compatibality and configuration problems.
   - Expo Go limitations: Some notification functionality could not be implemented as originallt planned due ti limitations encountered with Expo Go.
   - AI-generated code: Some generated code did not work as expected and required additional debugging and refinement.
   - Time-zone testing: A test related to daily meal counts and time-zone handling failed because the expected data was undefined.
     
**Discussion**

Discussions within the team were held during the development phase about the project's architecture and functionality
   - Database: MongoDB Atlas was chosen as the database instead of PostgreSQL, due to familiarity.
   - Specification refinement: Requirements were updated throughout development to address usability issues, technical limitations, and testing results.
