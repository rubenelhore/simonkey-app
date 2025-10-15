# 🐵 Simonkey - AI-Powered Study Platform

> Personalized learning platform using AI to extract key concepts and create mnemonic tools for better retention

[![Live Demo](https://img.shields.io/badge/Demo-Live-success)](https://simonkey.app)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen)]()

![Simonkey Home Page](https://i.imgur.com/T7NVdtC.png)

---

## 🎯 What is Simonkey?

Simonkey is an AI-powered EdTech platform serving Mexican students that transforms how they study and memorize concepts. Upload study materials, automatically extract key concepts, and use advanced mnemonic techniques to improve retention.

**🎥 [Watch Demo Video - Coming Soon](#)**

---

## ⚡ Key Features

### 📚 Smart Study Notebooks
- Create organized, topic-based study notebooks
- Manage multiple subjects in one place

### 🤖 AI-Powered Concept Extraction
- Automatically identifies key concepts from documents and resources
- Generates precise 20-30 word definitions
- Supports PDFs, links, and web research

### 🧠 Advanced Mnemonic Tools
- **Interactive Stories** connecting your concepts
- **Memorable Songs** for difficult terms
- **Visual Images** to reinforce memory
- **Custom Association Techniques**

### 📇 Flashcard System
- Anki-style spaced repetition
- Progress tracking and mastery levels
- Customizable study sessions

### 💬 AI Study Assistant
- Answer questions about any concept
- Dive deeper into topics on-demand

---

## 🏗️ Architecture
```
User Upload → Document Processing → AI Extraction (DeepSeek/Claude)
                                            ↓
              Concept Database (Firestore) ← Extracted Concepts
                                            ↓
    Flashcards ← Study Tools → Mnemonic Generation (AI)
```

---

## 🛠️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- React Router (navigation)
- Context API (state management)
- Vite (build tool)

**Backend:**
- Firebase Authentication (user management)
- Firestore (NoSQL database)
- Firebase Cloud Functions (serverless)

**AI Integration:**
- DeepSeek API (current MVP)
- Claude API (planned migration)
- Google Generative AI (embeddings)

**Deployment:**
- Vercel (frontend hosting)
- Firebase Hosting (alternative)

---

## 📊 Product Stats

- **Launch:** March 2025
- **Development Time:** 6+ months
- **Target Market:** Mexican high school and university students
- **Status:** MVP in production, active user testing

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project
- DeepSeek API key

### Installation
```bash
# Clone repository
git clone https://github.com/rubenelhore/simonkey.git
cd simonkey

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Add your keys:
# REACT_APP_FIREBASE_API_KEY=...
# REACT_APP_DEEPSEEK_API_KEY=...

# Run development server
npm run dev
```

Open http://localhost:5173

---

## 📸 Screenshots

### Notebook Dashboard
![Dashboard](https://via.placeholder.com/600x300?text=Dashboard+Screenshot)

### Concept Extraction
![Extraction](https://via.placeholder.com/600x300?text=Extraction+Screenshot)

### Flashcard Study Mode
![Flashcards](https://via.placeholder.com/600x300?text=Flashcards+Screenshot)

---

## 💡 How It Works

### 1. Create a Notebook
Students create topic-based notebooks for their subjects (e.g., "Biology Chapter 3")

### 2. Add Resources
Upload PDFs, paste links, or let AI research the web for relevant content

### 3. AI Extracts Concepts
DeepSeek API automatically identifies key terms and generates concise definitions

### 4. Customize & Study
Students review, edit, and study using flashcards and mnemonic tools

### 5. Track Progress
Built-in analytics show mastery levels and study patterns

---

## 🎓 What I Built & Learned

### Technical Achievements:
- **Full-stack AI platform** from concept to production
- **Firebase integration** for auth, database, and hosting
- **AI API orchestration** (DeepSeek, Claude, Google AI)
- **Type-safe React architecture** with Context API
- **Real-time analytics dashboard** tracking user progress

### Product Skills:
- **User research** with Mexican students (target market validation)
- **MVP scoping** and feature prioritization
- **Design to deployment** end-to-end ownership
- **Iterative development** based on user feedback

### Business Insights:
- EdTech market research and positioning
- Pricing model development
- Go-to-market strategy for student-focused SaaS

---

## 🚧 Roadmap

### Current (MVP - May 2025)
- ✅ User authentication and profiles
- ✅ Notebook creation and management
- ✅ AI-assisted concept extraction
- ✅ Basic flashcard study system
- ✅ Clean, functional interface

### Next Release (Q3 2025)
- 🔄 AI-generated mnemonic stories
- 🔄 Custom songs for memorization
- 🔄 Visual mnemonic images
- 🔄 Quiz generation and assessment
- 🔄 Migration to Claude API

### Future Vision
- 📱 Mobile app (React Native)
- 🌍 Multi-language support
- 👥 Collaborative study groups
- 📊 Advanced analytics dashboard
- 🎯 Adaptive learning algorithms

---

## 📦 Project Structure
```
simonkey/
├── src/
│   ├── components/         # React components
│   │   ├── Notebook/       # Notebook management
│   │   ├── Flashcard/      # Study tools
│   │   └── Extraction/     # AI concept extraction
│   ├── contexts/           # React Context providers
│   │   ├── AuthContext.tsx
│   │   └── NotebookContext.tsx
│   ├── services/           # API integrations
│   │   ├── firebase.ts
│   │   └── deepseek.ts
│   ├── hooks/              # Custom React hooks
│   └── types/              # TypeScript definitions
├── firebase/               # Firebase config & functions
└── README.md
```

---

## 🎯 Target Market

**Primary Users:**
- Mexican high school students (15-18 years)
- University students preparing for exams
- Self-learners and lifelong learners

**Value Proposition:**
- **Save time:** AI extracts concepts automatically (vs. manual note-taking)
- **Remember more:** Mnemonic techniques proven to improve retention
- **Study smarter:** Spaced repetition system optimizes review timing

---

## 🤝 Team & Contributions

**Founder & CEO:** Rubén Martínez Elhore
- Full-stack development
- AI integration
- Product strategy

This is a **solo founder project** built from scratch. Open to feedback and collaboration opportunities.

---

## 👨‍💻 About the Developer

**Rubén Martínez Elhore**
- **Role:** Co-Founder & CEO of Simonkey
- **Background:** Full-Stack ML Engineer, former Portfolio Analyst at Gentera
- **Experience:** 4+ years building AI applications and predictive models
- **Education:** Master's in Data Science (in progress), Industrial Engineering

**Connect:**
- GitHub: [@rubenelhore](https://github.com/rubenelhore)
- LinkedIn: [rubenelhore](https://linkedin.com/in/rubenelhore)
- Email: ruben.elhore@gmail.com

---

## 📝 License

Proprietary - All rights reserved

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev)
- [Firebase](https://firebase.google.com)
- [DeepSeek AI](https://deepseek.com)
- [Anthropic Claude](https://anthropic.com)

Special thanks to our beta testers and early adopters!

---

## 📞 Contact & Support

Interested in:
- **Partnership opportunities?**
- **Investing in EdTech?**
- **Hiring the developer?**

📧 ruben.elhore@gmail.com

---

**⭐ If you're working on similar EdTech projects, let's connect!**
