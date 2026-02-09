# Alvarado Investment Backend API

Express.js + TypeScript + MongoDB backend for the Alvarado Investment platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate Prisma client (after schema changes)
npx prisma generate

# Seed database
npm run db:seed:admin  # Create admin user
npm run db:seed:properties  # Seed properties
```

## 📋 Environment Variables

Create a `.env` file in the root directory:

```env
PORT=4001
DATABASE_URL="mongodb+srv://..."
ADMIN_API_KEY="your-admin-api-key"
JWT_SECRET="your-jwt-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:3000"

# Optional - Email configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="Alvarado Investment <noreply@alvarado.com>"
APP_NAME="Alvarado Investment"
APP_URL="http://localhost:3000"
ADMIN_EMAIL="admin@alvarado.com"

# Optional - IP Geolocation (free tier: 50k/month)
IPINFO_TOKEN=""
```

## 🏗️ Architecture

- **Framework**: Express.js 5.1.0
- **Language**: TypeScript 5.7.2
- **Database**: MongoDB Atlas (Prisma ORM)
- **Authentication**: JWT (access + refresh tokens)
- **Security**: bcrypt, helmet, cors, rate limiting
- **Email**: Nodemailer (SMTP)
- **Real-time**: Socket.io
- **File Upload**: Multer

## 📡 API Endpoints

### Public Routes (`/api/public`)
- `GET /team` - Get team members
- `GET /testimonials` - Get testimonials
- `GET /investments` - Get investment options

### Auth Routes (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /logout` - User logout
- `POST /refresh` - Refresh access token
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token

### User Routes (`/api/user`) - Protected
- `GET /profile` - Get user profile
- `PUT /profile` - Update profile
- `POST /change-password` - Change password
- `GET /balance` - Get wallet balance
- `GET /transactions` - Get transaction history
- `GET /investments` - Get user investments
- `POST /properties/:id/invest` - Invest in property
- And more...

### Admin Routes (`/api/admin`) - Admin Only
- **Properties**: Full CRUD for properties
- **Users**: User management, roles, KYC
- **Investments**: View/manage all investments
- **Team**: Manage team members
- **Testimonials**: Manage testimonials

See documentation files for complete API reference:
- `RBAC_SYSTEM.md` - Role-based access control
- `2FA_SECURITY_SYSTEM.md` - Two-factor authentication
- `NOTIFICATION_SYSTEM.md` - Email notifications
- `GEOLOCATION_SYSTEM.md` - IP geolocation
- `ADMIN_PROPERTIES_API.md` - Admin property API

## 🗄️ Database Collections

- **User** - User accounts with auth & profile data
- **Session** - Active user sessions
- **TeamMember** - Team member profiles
- **Testimonial** - User testimonials
- **InvestmentOption** - Investment opportunities
- **Property** - Real estate properties
- **Transaction** - Financial transactions
- **Transfer** - User-to-user transfers
- **UserInvestment** - User investment records
- **Notification** - User notifications
- **SupportTicket** - Support tickets
- **TicketMessage** - Ticket replies
- **FileAttachment** - Uploaded files
- **UserSettings** - User preferences
- **Referral** - Referral tracking
- **FundOperation** - Deposits & withdrawals

## 🔐 Security Features

- ✅ JWT authentication with refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Two-factor authentication (TOTP)
- ✅ Backup codes (SHA-256 hashed)
- ✅ Session management with timeout
- ✅ Email login alerts with geolocation
- ✅ Rate limiting on sensitive endpoints
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ Input validation with Zod
- ✅ Role-based access control (RBAC)

## 📦 Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## 🚀 Deployment

### Railway (Recommended)
1. Create new project on Railway
2. Connect GitHub repository
3. Set root directory: `./` (if this is the repo root)
4. Add environment variables
5. Deploy!

### Render
1. Create new Web Service
2. Root directory: `./`
3. Build: `npm install && npx prisma generate`
4. Start: `npm start`
5. Add environment variables

### Heroku
```bash
heroku create alvarado-backend
heroku config:set DATABASE_URL="..."
git push heroku main
```

## 📝 Notes

- Default port: 4001
- Demo user: `demo@alvarado.com` / `Demo1234!`
- MongoDB indexes created automatically on first run
- File uploads stored in `uploads/` directory
- Logs include request timing, size, and user ID

## 🔗 Frontend Connection

Update frontend `.env`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4001
# Or in production:
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

## 👥 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Create pull request

## 📄 License

Private - Alvarado Investment Platform
