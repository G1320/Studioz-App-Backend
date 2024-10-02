# Studioz App Backend

This repository contains the backend for the **Studioz** application. The backend is built using **Node.js**, **Express**, **MongoDB**, and **TypeScript**. It handles authentication, database interactions, and API endpoints for the Studioz application.

## Getting Started

To get started with the backend of the **Studioz** app, follow the steps below.

### Prerequisites

Ensure you have the following installed on your system:

- **Node.js** (v16.x or higher)
- **MongoDB** (set up a local instance or use MongoDB Atlas)

### Installation

1. Clone the repository:

1. Clone the repository:

```bash
   git clone https://github.com/G1320/Studioz-App-Backend.git
   cd studioz-app-backend
```

2. Install dependencies:

```bash
   npm install
```

### Set up Environment Variables

The app requires several environment variables for configuration. You can find an example in the `.env.example` file. To get started, create a `.env` file in the root of your project by copying `.env.example`:

```bash
cp .env.example .env
```

Fill in the values for the environment variables in your .env file. Here's an explanation of each:

NODE_ENV: The environment in which the app is running (development, production).

DB_URL: The connection string for your MongoDB instance.

JWT_SECRET_KEY: A secret key for signing JWTs.

JWT_REFRESH_KEY: A separate secret key for refreshing JWTs.

ALLOWED_ORIGINS: A comma-separated list of allowed origins for CORS and the Helmet CSP (e.g., http://localhost:3000,http://localhost:5173).

PORT: The port on which the server will run (default: 5000).

### Scripts

The available scripts you can use from the package.json file:

Install and Build: Installs all dependencies and builds the TypeScript files.

```bash
npm run build
```

Start the Server: Starts the backend server in production mode. Ensure you have run the build command first.

```bash
npm start
```

### Folder Structure

dist/: Contains the compiled TypeScript files.

src/: Contains the source TypeScript files.

server.ts: Entry point for the backend application.

### Author

Developed by Darnell Green.
