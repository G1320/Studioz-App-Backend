Studioz App Backend
This repository contains the backend for the Studioz application. The backend is built using Node.js, Express, MongoDB, and TypeScript. It handles authentication, database interactions, and API endpoints for the Studioz application.

Getting Started
To get started with the backend of the Studioz app, follow the steps below.

Prerequisites
Ensure you have the following installed on your system:

Node.js (v16.x or higher)
MongoDB (set up a local instance or use MongoDB Atlas)
Installation

1. Clone the repository:
   git clone https://github.com/yourusername/studioz-app-backend.git
   cd studioz-app-backend

2. Install dependencies:
   npm install

3. Set up environment variables:
   The app requires several environment variables for configuration. You can find an example in the .env.example file. To get started, create a .env file in the root of your project by copying
   .env.example via the following command: cp .env.example .env

Fill in the values for the environment variables in your .env file. Here's an explanation of each:

DB_URL: The connection string for your MongoDB instance (e.g., mongodb://localhost:{PORT}/studioz-app).
JWT_SECRET_KEY: A secret key for signing JWTs.
JWT_REFRESH_KEY: A separate secret key for refreshing JWTs.
NODE_ENV: The environment in which the app is running (development, production).
ALLOWED_ORIGINS: A comma-separated list of allowed origins for CORS and the Helmet CSP (e.g., http://localhost:3000,http://localhost:5173).
PORT: The port on which the server will run (default: 5000).

The available scripts you can use from the package.json file:

Install and Build: This command installs all dependencies and builds the TypeScript files.

npm run build
This command installs all dependencies and builds the TypeScript files.

npm start
This command starts the backend server in production mode. Ensure you have run npm run build first.

Folder Structure
dist/: Contains the compiled TypeScript files.
src/: Contains the source TypeScript files.
server.ts: Entry point for the backend application.
License
This project is licensed under the ISC License. See the LICENSE file for more details.

Author
Developed by Darnell Green.
