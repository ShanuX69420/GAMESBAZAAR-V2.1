# 🎮 Pakistan Gaming Marketplace

A P2P marketplace for Pakistani gamers to trade digital gaming assets, similar to FunPay but tailored for the Pakistani market with focus on mobile-first design, local payment methods, and fast performance.

## 🚀 Features

### ✅ Phase 1 Foundation (100% Complete)
- **User Authentication System** - Registration, login, JWT tokens
- **Games & Categories Management** - Admin-controlled game/category structure  
- **Listing System** - Create, browse, and manage listings with custom fields
- **Order & Escrow System** - Complete P2P trading with escrow protection
- **Real-time Chat** - Socket.io powered messaging between buyers/sellers
- **Admin Panel** - Complete admin dashboard with user/order management
- **Commission System** - Automated commission calculation and distribution

### 💰 Core Marketplace Features
- **P2P Trading** - Direct buyer-seller transactions
- **Escrow Protection** - Funds held until delivery confirmation
- **Real-time Messaging** - Order-based conversations with system messages
- **Commission Structure** - Automated fee collection (5-15% by category)
- **Multi-game Support** - Structured game → category → listings hierarchy
- **User Verification** - Verified sellers get instant fund access
- **Dispute System** - Built-in dispute handling for admins

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS + Shadcn/UI
- **Language**: TypeScript
- **State Management**: Zustand
- **Real-time**: Socket.io-client

### Backend
- **Runtime**: Node.js
- **Framework**: Fastify
- **Database**: PostgreSQL + Prisma ORM
- **Real-time**: Socket.io
- **Language**: TypeScript

## 📊 Current Statistics
- **8 Users** registered
- **3 Active Orders** (1 completed, 1 pending, 1 disputed)
- **3 Active Listings** across Valorant weapons
- **PKR 240 Revenue** generated in commissions

## 🏗️ Database Schema

### Core Tables
- `users` - User accounts with roles and verification
- `games` - Gaming titles (Valorant, PUBG Mobile, etc.)
- `categories` - Game-specific categories (Accounts, Keys, Skins)  
- `listings` - User-created item listings with custom fields
- `orders` - P2P transactions with escrow management
- `messages` - Real-time chat system tied to orders
- `transactions` - Financial records and commission tracking

### Order Flow
```
PENDING → PAID → DELIVERED → COMPLETED
              ↘ DISPUTED (admin intervention)
```

## 🔧 Setup & Installation

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis (for real-time features)

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure database URL in .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### Frontend Setup  
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Configure API URLs in .env.local
npm run dev
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Marketplace
- `GET /api/games` - List all games
- `POST /api/listings` - Create listing
- `GET /api/games/:slug/:category/listings` - Browse listings
- `POST /api/orders` - Create order

### Escrow System
- `PATCH /api/orders/:id/paid` - Mark order as paid
- `PATCH /api/orders/:id/delivered` - Mark as delivered  
- `PATCH /api/orders/:id/complete` - Release escrow
- `PATCH /api/orders/:id/dispute` - Initiate dispute

### Chat System
- `POST /api/orders/:id/messages` - Send message
- `GET /api/orders/:id/messages` - Get chat history
- `GET /api/messages` - User inbox

### Admin Panel
- `GET /api/admin/dashboard` - Analytics overview
- `GET /api/admin/orders` - Manage all orders
- `GET /api/admin/users` - User management
- `PATCH /api/admin/users/:id/ban` - Ban users
- `PATCH /api/admin/orders/:id/force-complete` - Force complete orders

## 💬 Real-time Features

### Socket.io Events
- `join-order` - Join order chat room
- `leave-order` - Leave order chat room  
- `new-message` - Receive real-time messages

## 🔒 Security Features

- **JWT Authentication** - Secure user sessions
- **Access Control** - Role-based permissions (user/admin)
- **Input Validation** - All inputs validated and sanitized
- **SQL Injection Protection** - Prisma ORM prevents SQL injection
- **CORS Protection** - Configured for frontend domain only

## 💳 Payment Integration (Planned)
- JazzCash API integration
- Easypaisa API integration  
- Bank transfer verification
- Automated withdrawal processing

## 📱 Mobile Optimization (Planned)
- PWA capabilities
- Touch-friendly interface
- Offline support for viewed content
- Native app-like experience

## 👥 User Roles

### Regular Users
- Create/browse listings
- Buy/sell items
- 48-hour fund hold after sales
- Standard withdrawal process

### Verified Users  
- Trust badge on profile
- Instant fund access
- Priority support
- Manual admin verification

### Admins
- Complete dashboard access
- User management (ban/verify)
- Order intervention
- System configuration

## 🎯 Testing

### Manual Tests Completed
- ✅ User registration and login flow
- ✅ Complete escrow transaction (PKR 3000 → PKR 3240 → PKR 3000 to seller)
- ✅ Real-time chat between buyer/seller  
- ✅ Admin dashboard and management tools
- ✅ Access control and security validation
- ✅ Order dispute system

## 📈 Next Steps (Phase 2)

### Payment Integration
- JazzCash/Easypaisa API integration
- Automated payment verification
- Withdrawal processing system

### Frontend Development  
- Complete Next.js UI implementation
- Mobile-responsive design
- Real-time chat interface

### Advanced Features
- Multi-language support (Urdu/English)
- Advanced search and filtering
- User reputation system
- Automated delivery for digital keys

## 📝 License

This project is developed for educational and commercial purposes. All rights reserved.

## 🤝 Contributing

This is a private commercial project. Contact the development team for collaboration opportunities.

---

**Status**: Phase 1 Foundation Complete ✅  
**Total Development Time**: ~4 hours  
**Backend API**: Fully functional with 25+ endpoints  
**Database**: Production-ready schema with sample data  
**Real-time Chat**: Socket.io implementation complete  
**Admin Panel**: Full management dashboard operational

Built with ❤️ for the Pakistani gaming community 🇵🇰