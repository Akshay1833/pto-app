# 🏖️ Holiday & Sick Day Request App

A minimal internal web application for managing employee holiday and sick day requests. Built for small teams, this app streamlines request submission, approval workflows, and leave tracking.

---

## 🚀 Features

* 🔐 Microsoft Entra (Azure AD) authentication
* 📝 Submit leave requests (Holiday / Sick)
* ⏱️ Multiple duration types (Full day / Partial day)
* ✅ Approve or ❌ deny requests (HR workflow)
* 📊 Automatic leave balance tracking
* 👥 Designed for internal company use
* ⚡ Fast deployment with Vercel

---

## 🛠️ Tech Stack

* **Frontend:** Next.js (App Router)
* **Backend:** Next.js API routes
* **Authentication:** NextAuth + Microsoft Entra ID
* **Database:** Prisma ORM
* **Hosting:** Vercel

---

## 📦 Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-repo/holiday-app.git
cd holiday-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=
```

### 4. Run database migrations

```bash
npx prisma migrate dev
```

### 5. Start the development server

```bash
npm run dev
```

App will be available at:
👉 [http://localhost:3000](http://localhost:3000)

---

## 🔐 Authentication Setup (Microsoft Entra)

1. Register an application in Microsoft Entra ID
2. Add a **Web platform** redirect URI:

```
http://localhost:3000/api/auth/callback/azure-ad
```

3. Generate a client secret
4. Copy values into your `.env` file

---

## 🧪 Testing Strategy

The application includes multiple decision paths based on:

* Leave type (8 types)
* Duration (Full / Partial)
* Approval status (Approve / Deny)

### Recommended Testing Approach

* Manual testing for UI validation
* Automated testing using:

  * **Jest** for logic validation
  * **Playwright** for end-to-end flows

---

## 🚀 Deployment

This app is optimized for deployment on **Vercel**.

### Steps:

1. Push code to GitHub
2. Import project into Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

---

## ⚠️ Common Issues

### ❌ DATABASE_URL missing

Ensure your `.env` file includes:

```env
DATABASE_URL=your_database_connection_string
```

### ❌ Login not working

* Verify Azure credentials
* Ensure redirect URI matches exactly
* Check NEXTAUTH_SECRET is set

---

## 📁 Project Structure

```
/app
  /api
  /dashboard
  /components
/prisma
  schema.prisma
```

---

## 🎯 Future Improvements

* 📅 Calendar view of leave
* 📧 Email notifications
* 📈 Reporting dashboard
* 🔔 Slack / Teams integration

---

## 🤝 Contributing

This is an internal project. Contributions should follow company guidelines.

---

## 📄 License

Private Internal Use Only

---

## 👨‍💻 Author

Built for internal company use to simplify leave management and improve HR workflows.
