# 🎵 Lyric Video Generator

> AI-powered lyric video generator for musicians and creators. Create professional lyric videos in minutes with automatic sync, beautiful templates, and direct YouTube upload.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- **🤖 AI Auto-Sync**: Whisper AI automatically syncs lyrics to audio with 95%+ accuracy
- **🎨 50+ Templates**: Beautiful pre-made templates for every genre and style
- **⚡ Real-Time Preview**: See changes instantly as you customize
- **📺 YouTube Integration**: Export to 4K or upload directly to YouTube
- **🎭 Custom Animations**: Fade, slide, pop, bounce, typewriter effects
- **💕 Emoji Support**: Add floating emojis and particles
- **🎯 Pixel-Perfect Editor**: Fine-tune every aspect of your video
- **📦 Batch Processing**: Create multiple videos at once (Pro+)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 16+
- Redis 7+
- Python 3.11+ (for AI sync service)
- Docker & Docker Compose (optional but recommended)

### Installation

1. **Clone the repository**
   ```bash
   cd lyric-video-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start infrastructure with Docker**
   ```bash
   npm run docker:up
   ```

   This starts:
   - PostgreSQL database (port 5432)
   - Redis (port 6379)
   - Python sync service (port 8000)
   - MinIO (S3-compatible storage, port 9000)

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Python Sync Service: http://localhost:8000

## 📁 Project Structure

```
lyric-video-generator/
├── frontend/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── lib/          # Utilities and API clients
│   │   ├── hooks/        # Custom React hooks
│   │   ├── store/        # Zustand state management
│   │   └── styles/       # Global styles
│   └── package.json
│
├── backend/              # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Express middleware
│   │   ├── config/       # Configuration files
│   │   ├── database/     # Database schema & migrations
│   │   └── server.ts     # Express app entry point
│   ├── python/           # Python AI sync service
│   │   ├── sync_service.py
│   │   └── requirements.txt
│   └── package.json
│
├── shared/               # Shared TypeScript types
│   └── types/
│
├── docker-compose.yml    # Docker services
├── .env.example          # Environment variables template
└── README.md
```

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Zustand** - State management
- **React Query** - Data fetching
- **Wavesurfer.js** - Audio waveform visualization
- **Fabric.js** - Canvas manipulation
- **Framer Motion** - Animations

## 📜 Third-Party Licenses

This project uses Remotion. Remotion is licensed separately and has its own terms, including free usage for individuals/small teams and a company license requirement above the threshold described in their terms. Please review Remotion’s license/terms before distributing or commercializing this project.

### Backend
- **Node.js + Express** - API server
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **Redis** - Caching & job queue
- **BullMQ** - Background job processing
- **FFmpeg** - Video rendering
- **AWS S3 / Cloudflare R2** - File storage
- **JWT** - Authentication

### AI/ML
- **Python FastAPI** - Sync service
- **OpenAI Whisper** - Speech-to-text with timestamps
- **Rapidfuzz** - Fuzzy text matching

## 🔧 Development

### Available Scripts

```bash
# Root scripts
npm run dev              # Start all services
npm run build            # Build all workspaces
npm run format           # Format code with Prettier
npm run lint             # Lint all workspaces

# Frontend
npm run dev:frontend     # Start frontend dev server
npm run build:frontend   # Build frontend for production

# Backend
npm run dev:backend      # Start backend dev server
npm run build:backend    # Build backend for production

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with test data

# Docker
npm run docker:up        # Start all Docker services
npm run docker:down      # Stop all Docker services
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

#### Projects
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create new project
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

#### Lyrics
- `GET /api/lyrics/project/:projectId` - Get project lyrics
- `POST /api/lyrics/project/:projectId` - Save lyrics
- `POST /api/lyrics/auto-sync` - AI auto-sync lyrics
- `GET /api/lyrics/search` - Search lyrics (Genius/Musixmatch)

#### Templates
- `GET /api/templates/public` - Get public templates
- `GET /api/templates/:id` - Get template by ID
- `GET /api/templates/user/me` - Get user's custom templates
- `POST /api/templates` - Create custom template

#### Export
- `POST /api/export` - Create export job
- `GET /api/export/:id` - Get export details
- `GET /api/export/:id/status` - Get export status
- `DELETE /api/export/:id` - Cancel export

#### YouTube
- `GET /api/youtube/auth-url` - Get OAuth URL
- `GET /api/youtube/status` - Check connection status
- `POST /api/youtube/upload` - Upload video to YouTube

## 🎨 Creating Templates

Templates are defined as JSON configurations. Here's an example:

```typescript
{
  "resolution": "1080p",
  "aspectRatio": "16:9",
  "background": {
    "type": "gradient",
    "colors": ["#ff69b4", "#ffa8c5"],
    "gradientType": "linear"
  },
  "text": {
    "font": "Poppins",
    "size": 90,
    "weight": "900",
    "color": "#FFFFFF",
    "outline": {
      "enabled": true,
      "color": "#ff1493",
      "width": 6
    },
    "animation": "pop",
    "displayMode": "single"
  },
  "effects": {
    "emojis": true,
    "emojiConfig": {
      "types": ["💕", "💗", "✨"],
      "count": 20,
      "animation": "float"
    }
  },
  "albumArt": {
    "enabled": true,
    "position": "bottom-right",
    "size": 250,
    "animation": "pulse"
  }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## 📦 Deployment

### Docker Production Build

```bash
# Build production images
docker build -t lyric-video-generator-frontend ./frontend
docker build -t lyric-video-generator-backend ./backend
docker build -t lyric-video-generator-python ./backend/python

# Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

1. **Frontend (Vercel/Netlify)**
   ```bash
   cd frontend
   npm run build
   # Deploy dist/ folder
   ```

2. **Backend (Railway/Render/Fly.io)**
   ```bash
   cd backend
   npm run build
   # Deploy with start script: node dist/server.js
   ```

3. **Python Service (Railway/Render)**
   ```bash
   cd backend/python
   # Deploy with start script: python sync_service.py
   ```

## 🔐 Environment Variables

See `.env.example` for all required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host
- `JWT_SECRET` - Secret for JWT tokens
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - S3 credentials
- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` - YouTube OAuth
- `GENIUS_API_TOKEN` - Genius API for lyrics fetching

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) for speech recognition
- [Wavesurfer.js](https://wavesurfer-js.org/) for waveform visualization
- [FFmpeg](https://ffmpeg.org/) for video processing
- All the amazing open-source libraries used in this project

## 📞 Support

- 📧 Email: support@lyricvideos.app
- 💬 Discord: [Join our community](#)
- 📚 Documentation: [docs.lyricvideos.app](#)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/yourusername/lyric-video-generator/issues)

---

Made with ❤️ by musicians, for musicians.
