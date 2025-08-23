# Stock Market Trading Game

A team-based stock market trading competition built with React, TypeScript, and Supabase.

## Project info

**URL**: https://lovable.dev/projects/6691239d-82cf-4487-b872-135a13f118a4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/6691239d-82cf-4487-b872-135a13f118a4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## 🚀 Local Development Setup

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v18 or higher) - [Install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- **npm** (comes with Node.js)
- **Docker** (for Supabase local development) - [Install Docker](https://docs.docker.com/get-docker/)
- **Git** - [Install Git](https://git-scm.com/downloads)

### Step-by-Step Setup

#### 1. Clone the Repository

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Start Supabase Local Development

```bash
# Install Supabase CLI (if not already installed)
npm install -g @supabase/cli

# Start local Supabase instance
npx supabase start
```

This will start all Supabase services locally:
- **Database**: PostgreSQL on port 54322
- **API**: REST API on port 54321
- **Studio**: Web interface on port 54323
- **Auth**: Authentication service
- **Storage**: File storage service

#### 4. Database Setup

The database will be automatically set up with:
- ✅ All required tables (teams, players, stocks, trades, etc.)
- ✅ Sample data (20 stocks, test team, admin user)
- ✅ Proper relationships and constraints
- ✅ Row Level Security policies

#### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:8080** (or next available port)

### 🔑 Default Login Credentials

#### Admin Access
- **URL**: http://localhost:8080/admin-login
- **Username**: `admin`
- **Password**: `admin123`

#### Team Access (Test Team)
- **URL**: http://localhost:8080/team-login
- **Team Number**: `1001`
- **Password**: `team123`

### 📊 Application Features

#### Admin Dashboard
- Team management (approve/reject registrations)
- Stock management (20 stocks available)
- Price management (set prices for 8 rounds)
- Game control (manage current round)
- Leaderboard tracking

#### Team Dashboard
- Portfolio management
- Stock trading (buy/sell with restrictions)
- Real-time profit/loss calculations
- Cash balance tracking
- Trading rules enforcement

### 🎮 Game Rules

- **Starting Balance**: ₹20,00,000 per team
- **Brokerage**: 1% on all trades
- **Trading Rounds**: 8 total rounds
- **Selling Restriction**: Only allowed from Round 4 onwards
- **Team Size**: 4 players per team
- **Stocks Available**: 20 different stocks

### 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Start Supabase services
npx supabase start

# Stop Supabase services
npx supabase stop

# Reset database (reapply migrations and seed data)
npx supabase db reset

# View Supabase status
npx supabase status
```

### 🔧 Troubleshooting

#### Port Conflicts
If port 8080 is in use, Vite will automatically use the next available port (8081, 8082, etc.)

#### Database Issues
```bash
# Reset the database if you encounter issues
npx supabase db reset

# Check Supabase service status
npx supabase status
```

#### Docker Issues
```bash
# Restart Docker if Supabase won't start
docker restart $(docker ps -q)

# Clean up Docker containers
npx supabase stop
npx supabase start
```

### 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   └── ui/             # shadcn-ui components
├── pages/              # Application pages
│   ├── AdminLogin.tsx
│   ├── AdminDashboard.tsx
│   ├── TeamLogin.tsx
│   ├── TeamRegistration.tsx
│   └── PlayerDashboard.tsx
├── lib/                # Utility functions
│   ├── utils.ts
│   └── auth.ts         # Password hashing utilities
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client and types
└── hooks/              # Custom React hooks

supabase/
├── migrations/         # Database schema migrations
├── seed.sql           # Sample data
└── config.toml        # Supabase configuration
```

## What technologies are used for this project?

This project is built with:

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn-ui, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Security**: bcrypt password hashing
- **Development**: Docker, Supabase CLI

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/6691239d-82cf-4487-b872-135a13f118a4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
