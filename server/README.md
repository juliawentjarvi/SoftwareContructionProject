# Bear Buddy API

Standalone TypeScript/Express API for the Expo client. MongoDB Atlas stores account profiles and meal entries. The service does not store calories, weight, or medical diagnoses; meal notes are optional and should not contain sensitive health details.

## Local setup

1. Create a MongoDB Atlas database and allow the development machine's IP in the Atlas network access list.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a unique random `JWT_SECRET` of at least 32 characters. Meal reminders are scheduled locally on the device after notification permission is granted; the app cannot override Do Not Disturb or Focus settings.
	If the network's DNS resolver refuses MongoDB SRV lookups, set `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8`; verify that your network permits direct DNS queries to those resolvers.
3. Run `npm install` and `npm run dev` from this directory.
4. The API listens on `http://localhost:3000`; `GET /health` is available without a database-backed user session after startup.

For a production deployment, use a managed Node host, set the same environment variables in its secret manager, restrict `ALLOWED_ORIGINS` to the deployed web client origins, and keep Atlas network access limited to the host. Native Android/iOS clients do not send browser origins, so CORS is only a browser restriction, not an API authentication mechanism.

## API contract

All error responses use `{ "error": { "code": "...", "message": "..." } }`. Protected endpoints require `Authorization: Bearer <accessToken>`. Access tokens expire according to `JWT_EXPIRES_IN` (7 days by default).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health |
| `POST` | `/api/auth/register` | Create account; accepts `email`, `password`, `displayName`, optional IANA `timezone` |
| `POST` | `/api/auth/login` | Sign in with `email` and `password` |
| `GET` | `/api/auth/me` | Return the signed-in profile |
| `DELETE` | `/api/auth/me` | Delete the signed-in profile and meal entries |
| `GET` | `/api/profile` | Read profile and daily meal goal |
| `PATCH` | `/api/profile` | Update `displayName`, `timezone`, `dailyMealGoal`, `notificationsEnabled`, and/or `reminderTimes` |
| `GET` | `/api/meals` | List up to 100 entries; optional ISO `from`, `to`, and `limit` query parameters |
| `POST` | `/api/meals` | Create entry with `name`, `mealType`, ISO `eatenAt`, optional `notes` |
| `PATCH` | `/api/meals/:mealId` | Update an owned entry, including its name |
| `DELETE` | `/api/meals/:mealId` | Delete an owned entry |
| `GET` | `/api/progress` | Return today's count, goal status, current streak, and the last seven days |

Meal types are `breakfast`, `lunch`, `dinner`, and `snack`. Progress days use the profile's IANA timezone. A day counts toward a streak when it meets the user's configurable meal goal; an unfinished current day does not break the streak until that day ends.

## Checks

Run `npm test`, `npm run typecheck`, and `npm run build` from this directory.