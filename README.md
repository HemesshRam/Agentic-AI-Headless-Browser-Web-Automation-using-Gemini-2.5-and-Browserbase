# Agentic AI Headless Browser Web Automation using Gemini 2.5 and Browserbase 

<p align="center">
  <strong>Industrial-Grade AI-Powered Browser Automation Framework</strong><br/>
  Powered by Google Gemini Computer-Use, Browserbase Cloud Browsers & Real-Time Dashboard
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/React-v19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Gemini-2.5_CU-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Browserbase-Cloud-FF6B35?style=for-the-badge" />
</p>

---

## 📋 Table of Contents

- [Description](#-description)
- [Key Objectives](#-key-objectives)
- [Technical Stack](#-technical-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Execution Steps](#-execution-steps)
- [Usage Examples](#-usage-examples)
- [Advantages](#-advantages)
- [Limitations](#-limitations)

---

## 📖 Description

**Agentic AI Headless Browser Web Automation using Gemini 2.5 and Browserbase** is an industrial-grade, AI-powered web browser automation framework that can understand natural language commands and autonomously execute complex multi-step tasks on **any website** — from e-commerce product research to financial data extraction.

Unlike traditional automation tools that rely on brittle CSS selectors and hardcoded workflows, this system uses **Google Gemini's Computer-Use vision model** to analyze live screenshots of web pages and decide what to do next — just like a human would. It sees the page, understands the context, and takes action.

### What Makes It Different?

| Traditional Automation | Web Automation Pro |
|---|---|
| Requires writing scripts per website | Understands natural language prompts |
| Breaks when UI changes | Uses vision — adapts to any layout |
| Needs CSS selectors / XPaths | Clicks by coordinates like a human |
| Manual error handling | Self-correcting with loop detection |
| No real-time visibility | Live dashboard with AI narration |

### Example Workflow

```
User: "Search for iPhone 17 Pro on Amazon, click the first product, and extract the price"

System: 
  Step 1: Navigate to amazon.com                    ✅
  Step 2: Type "iPhone 17 Pro" in search box         ✅ (auto-presses Enter)
  Step 3: Click first product in results             ✅
  Step 4: Extract price ($1,075.90) + delivery date  ✅
  
Result: { price: "$1,075.90", deliveryDate: "May 13-15" }
```

---

## 🎯 Key Objectives

1. **Universal Website Support** — Works on any website without site-specific code. Uses URL-pattern detection and vision analysis to adapt dynamically.

2. **Natural Language Interface** — Users describe tasks in plain English. The system parses intent, determines the target URL, and executes autonomously.

3. **Self-Correcting Intelligence** — Detects stuck loops (retyping same query, endless scrolling), blocks duplicate actions, and auto-recovers without human intervention.

4. **Real-Time Observability** — Dynamic dashboard with live browser view, step-by-step timeline, screenshot gallery, and AI voice narration.

5. **Cloud-Native Execution** — Runs on Browserbase cloud browsers with anti-bot stealth, eliminating the need for local Chrome installations or proxy management.

6. **Production Reliability** — Session crash recovery, navigation timeout resilience, overlay/popup auto-dismissal, and auth-wall detection.

---

## 🛠 Technical Stack

### Backend (Node.js)

| Technology | Purpose | Version |
|---|---|---|
| **Node.js** | Runtime environment | ≥ 20.0 |
| **Express.js** | REST API server | v5.2 |
| **WebSocket (ws)** | Real-time event streaming to frontend | v8.20 |
| **Puppeteer** | Browser automation protocol (CDP) | v22.15 |
| **Puppeteer Stealth** | Anti-bot fingerprint randomization | v2.11 |
| **@google/genai** | Gemini Vision & Computer-Use API | v1.52 |
| **Groq SDK** | Ultra-fast intent parsing (LLaMA 3.3 70B) | v1.1 |
| **Axios** | HTTP client for Tavily search + Browserbase API | v1.15 |
| **Winston** | Structured logging with file rotation | v3.19 |
| **dotenv** | Environment configuration management | v17.4 |

### Frontend (React + Vite)

| Technology | Purpose | Version |
|---|---|---|
| **React** | UI component library | v19.2 |
| **Vite** | Build tool & dev server | v8.0 |
| **Recharts** | Analytics charts in Dashboard | v3.8 |
| **Lucide React** | Icon library | v1.14 |
| **Web Speech API** | AI voice narration (browser-native TTS) | Native |
| **CSS3** | Custom glassmorphism design system | — |

### Cloud Services

| Service | Purpose |
|---|---|
| **Browserbase** | Cloud browser infrastructure (anti-bot, stealth, scalable) |
| **Google Gemini 2.5 Computer-Use** | Vision-based screenshot analysis & action planning |
| **Groq Cloud** | Sub-second intent parsing with LLaMA 3.3 70B |
| **Tavily Search API** | URL discovery when user prompt doesn't contain a URL |

---

## 🏗️ Architecture

```mermaid
flowchart TD
    %% User Interaction
    User([👤 User]) -- "Natural Language Prompt" --> Dash["🖥️ React Dashboard"]
    
    subgraph Frontend["Frontend Layer (React + Vite)"]
        Dash -- "Input Command" --> WS_Send{{"WebSocket Protocol"}}
    end

    WS_Send -- "Stream Events" --> SRV["⚙️ Express & WS Server"]

    subgraph Backend["Core Intelligence (Node.js)"]
        SRV --> Intent["🧠 Intent Router"]
        Intent --> Orchestrator["🎭 Task Orchestrator"]
        Orchestrator --> AgentRouter["🤖 Agent Reasoning"]
        AgentRouter --> Tools["🔧 Tool Executor"]
        
        %% Feedback Loops
        Tools -- "Action Result" --> Orchestrator
        Orchestrator -- "Plan Next Step" --> AgentRouter
    end

    %% External AI Services
    subgraph AI_Services["AI Service Layer"]
        Intent -- "Parse Goal" --> GROQ["⚡ Groq (LLaMA 3.3)"]
        Intent -- "Find Target URL" --> TAV["🔎 Tavily Search"]
        AgentRouter -- "Analyze Screenshots" --> GEMINI["👁️ Gemini 2.5 CU"]
    end

    %% Browser Execution
    subgraph Browser_Cloud["Execution Layer"]
        Tools -- "Puppeteer/CDP" --> BB["☁️ Browserbase Cloud"]
        BB -- "Live View / Screenshots" --> Dash
    end

    %% Styling
    classDef frontend fill:#0f172a,stroke:#00ffcc,color:#e2e8f0,stroke-width:2px
    classDef backend fill:#1e293b,stroke:#3b82f6,color:#e2e8f0,stroke-width:2px
    classDef ai fill:#1a1a2e,stroke:#f59e0b,color:#e2e8f0,stroke-dasharray: 5 5
    classDef cloud fill:#1a1a2e,stroke:#ec4899,color:#e2e8f0

    class Dash frontend
    class SRV,Intent,Orchestrator,AgentRouter,Tools backend
    class GROQ,TAV,GEMINI ai
    class BB cloud
```

---

## Project ZIP File
https://drive.google.com/file/d/1x5cUdtNt-dhoVlRiFTwrM8iA0t1wvMBg/view?usp=sharing

## 📁 Project Structure

```
browserbase_automation/
├── server.js                    # Express + WebSocket server entry point
├── package.json                 # Backend dependencies & scripts
├── Dockerfile                   # Backend Docker configuration
├── docker-compose.yml           # Multi-container orchestration
├── .dockerignore                # Docker ignore rules
├── .env                         # Environment configuration (API keys, timeouts)
├── .env.example                 # Template for environment setup
├── .gitignore                   # Git ignore rules
│
├── src/                         # ── Backend Source Code ──
│   ├── main.js                  # Automation entry point (CLI + API)
│   ├── intent-router.js         # Groq LLaMA intent parser + Tavily URL search
│   ├── website-analyzer.js      # Site profiling (known sites + dynamic analysis)
│   ├── task-validator.js        # Input validation & complexity scoring
│   ├── task-orchestrator.js     # 🧠 Core brain — step loop, guards, auto-submit
│   ├── agent-reasoning.js       # Agent router (Vision vs Computer-Use)
│   ├── vision-analyzer.js       # Gemini Flash vision analysis
│   ├── computer-use-agent.js    # Gemini Computer-Use multi-turn agent
│   ├── prompt-builder.js        # Unified prompt construction (single source of truth)
│   ├── tool-executor.js         # Action execution (click, type, scroll, navigate)
│   ├── viewport-guard.js        # Overlay suppression, scroll protection
│   ├── scroll-manager.js        # Intelligent scroll management
│   ├── browser-manager.js       # Local Puppeteer browser management
│   ├── browserbase-manager.js   # Browserbase cloud browser integration
│   ├── logger.js                # Winston logger with WebSocket broadcasting
│   └── ws-broadcaster.js        # WebSocket event relay
│
├── config/                      # ── Configuration ──
│   └── environment-loader.js    # Dynamic environment validation
│
├── frontend/                    # ── React Frontend (Vite) ──
│   ├── Dockerfile               # Frontend Docker configuration
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx              # Main application with WebSocket integration
│       ├── App.css              # Global styles
│       ├── index.css            # Design system tokens
│       ├── main.jsx             # React entry point
│       ├── components/
│       │   ├── AiOrb.jsx/css        # Animated AI orb (idle/thinking/automating/success/error)
│       │   ├── CommandBar.jsx/css    # Spotlight-style command input
│       │   ├── Dashboard.jsx/css     # Analytics dashboard with session history
│       │   ├── LiveTerminal.jsx/css  # Real-time server log viewer
│       │   ├── MetricsPanel.jsx/css  # Status bar (step, confidence, mode)
│       │   ├── ScreenshotViewer.jsx  # Step-by-step screenshot gallery
│       │   ├── Settings.jsx/css      # Configuration panel
│       │   ├── Subtitles.jsx/css     # Voice narration subtitle overlay
│       │   ├── TaskTimeline.jsx/css  # Step timeline with status indicators
│       │   └── WelcomeSplash.jsx/css # Activation splash screen
│       └── services/
│           └── VoiceEngine.js       # Browser TTS with effective narration
│
├── cache/                       # Screenshot cache (auto-generated)
├── logs/                        # Winston log files (auto-generated)
├── reports/                     # Task execution reports (auto-generated)
├── data/                        # Persistent data storage
├── selectors/                   # CSS selector configs
└── prompts/                     # Prompt templates
```

---

## 🚀 Execution Steps

### Prerequisites

- **Node.js** ≥ 20.0.0 ([Download](https://nodejs.org/))
- **npm** ≥ 10.0.0
- API keys for: **Google Gemini**, **Browserbase**, **Groq**, **Tavily**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/web-automation-pro-v6.1.git
cd web-automation-pro-v6.1
```

### 2. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Gemini API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_COMPUTER_USE_MODEL=gemini-2.5-computer-use-preview-10-2025

# Browserbase
USE_BROWSERBASE=true
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_project_id

# Groq (Intent Parsing)
GROQ_API_KEY=your_groq_api_key

# Tavily (URL Discovery)
TAVILY_API_KEY=your_tavily_api_key
```

### 4. Start the Application

```bash
# Start both backend server and frontend dev server
npm run dev:all
```

This launches:
- **Backend**: `http://localhost:3001` (Express + WebSocket)
- **Frontend**: `http://localhost:5173` (Vite dev server)

### 5. Open the Dashboard

Navigate to `http://localhost:5173` in your browser. Click the splash screen to activate, then type your automation command in the command bar at the bottom.

```

---

## 🐋 Docker Implementation & Usage

Using Docker is the **highly recommended** way to run this framework. It encapsulates all complex system-level dependencies required by Puppeteer (like Chromium's Linux dependencies) and ensures the environment is identical across different machines.

### 🌟 Why Use Docker?
- **Zero Local Dependencies**: You don't need to install Node.js or system libraries locally.
- **Pre-configured Puppeteer**: The Docker images include `libnss3`, `libgbm-dev`, and other crucial libraries that often cause "Chromium failed to launch" errors on local systems.
- **Hot Reloading**: Changes to your local source code are immediately reflected inside the containers via volume mounts.

### 🛠️ Detailed Setup & Execution

#### 1. Configuration
Ensure your `.env` file is present in the root directory. Docker Compose will automatically inject these variables into both the backend and frontend containers.

#### 2. Access the Application
Once the containers are running, access the services here:
- **Main Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

#### 3. Lifecycle Commands
| Action | Command |
|---|---|
| **Build & Start** | `docker-compose up --build` |
| **Stop** | `docker-compose down` |
| **View All Logs** | `docker-compose logs -f` |
| **Restart Backend** | `docker-compose restart backend` |

#### 4. Advanced Usage (Inside the Container)
You can execute npm scripts directly inside the running container without stopping the service:

*   **Enter the Backend Shell:**
    ```bash
    docker exec -it web-automation-backend bash
    ```
*   **Run Connectivity Tests:**
    ```bash
    docker exec -it web-automation-backend node test-apis.js
    ```
*   **Trigger Specialized Automation:**
    ```bash
    # Run automation on DemoQA playground
    docker exec -it web-automation-backend npm run demoqa
    ```

### 📁 Volume Persistence
The `docker-compose.yml` maps your local directory to the container. This means:
- **Logs**: Found in `./logs` locally after execution.
- **Screenshots**: Generated in `./cache` are accessible instantly.
- **Reports**: JSON/HTML reports in `./reports` are saved to your host machine.

### 🧩 Troubleshooting Docker
- **Port Conflict**: If port `3001` or `5173` is already in use, edit the `ports` section in `docker-compose.yml`.
- **Permission Errors**: On some Linux systems, ensure the `logs/` and `cache/` directories have write permissions for the Docker user.

---

---

## 💡 Usage Examples

| Prompt | What It Does |
|---|---|
| `Search for iPhone 17 Pro on Amazon, click the first product, and extract the price` | Navigates → searches → clicks → extracts product data |
| `Go to Yahoo Finance, type TSLA, click the first autocomplete suggestion, and summarize the page` | Finance data extraction with autocomplete interaction |
| `Navigate to YouTube and search for 'Interstellar theme music', play the first video` | Video platform navigation and interaction |
| `Open booking.com, search for hotels in Paris for June 15-20` | Travel site automation with date selection |
| `Go to GitHub and find the most starred Python repositories` | Developer tool navigation and data extraction |

---

## ✅ Advantages

### 1. **Zero-Code Automation**
No programming required. Users describe tasks in natural language and the system figures out the rest — URL discovery, navigation, interaction, and data extraction.

### 2. **Universal Website Compatibility**
Works on **any website** without site-specific scripts. The vision model adapts to any UI layout, making it resilient to design changes that break traditional selector-based automation.

### 3. **Self-Correcting Intelligence**
- **Never-type-twice guard**: Prevents infinite search loops
- **Auto-submit after search**: System handles Enter/autocomplete automatically
- **Consecutive scroll limiter**: Forces completion when enough data is collected
- **Stuck loop recovery**: Attempts recovery before aborting

### 4. **Real-Time Observability**
Full visibility into the automation process through:
- Live browser view (embedded Browserbase session)
- Step-by-step task timeline with reasoning
- Screenshot gallery for visual debugging
- Live terminal with server logs
- AI voice narration of each step

### 5. **Cloud-Native & Scalable**
Browserbase cloud browsers eliminate local Chrome dependencies, provide built-in anti-bot stealth, and support parallel execution across multiple sessions.

### 6. **Multi-Model AI Pipeline**
Leverages the best model for each job:
- **Groq LLaMA 3.3 70B**: Ultra-fast intent parsing (< 500ms)
- **Gemini 2.5 Flash**: Quick visual analysis for simple tasks
- **Gemini Computer-Use**: Multi-turn reasoning for complex interactions
- **Tavily Search**: Web search for URL discovery

### 7. **Production-Grade Error Handling**
- Navigation timeout resilience (continues on partial page loads)
- Browser session crash recovery with data preservation
- Auth-wall detection (aborts cleanly when login is required)
- Overlay/popup auto-dismissal (cookie banners, consent dialogs)

---

## ⚠️ Limitations

### 1. **API Cost & Rate Limits**
Each step requires a Gemini API call with a screenshot (~$0.002-0.01 per call). A 15-step task costs approximately $0.03-0.15. Browserbase sessions have usage-based pricing. High-volume automation can become expensive.

### 2. **Vision Model Accuracy**
The Gemini vision model occasionally:
- Misidentifies UI elements (clicks wrong button)
- Fails to read small or low-contrast text
- Struggles with highly dynamic content (animations, video players)
- May not correctly interpret complex layouts (multi-column, nested scrolls)

### 3. **No Login/Authentication Support**
The system cannot log into websites. Tasks requiring authentication will be detected and aborted. Workaround: Pre-authenticate the Browserbase session manually.

### 4. **Speed Constraints**
Each step takes 8-15 seconds (screenshot capture + API call + execution). A full task typically takes 1-3 minutes. This is slower than hardcoded scripts but the trade-off is universality.

### 5. **Anti-Bot Detection**
Despite stealth plugins, some websites (e.g., Cloudflare-protected sites) may still detect and block the automated browser. Browserbase mitigates this but doesn't guarantee 100% bypass.

### 6. **No Complex Form Filling**
While the system can type text into inputs, multi-step forms with date pickers, dropdowns, file uploads, and CAPTCHA challenges are not reliably handled.

### 7. **Single-Tab Execution**
The current architecture supports one browser tab per task. Tasks requiring multi-tab workflows (e.g., comparing products in different tabs) are not supported.

### 8. **Internet Dependency**
Requires stable internet connectivity for Gemini API, Groq API, Tavily API, and Browserbase cloud browsers. Offline operation is not supported.

---

## 🏁 Conclusion

Web Automation Pro v6.1 demonstrates that **vision-driven AI agents** can replace brittle, selector-based automation with a system that truly *sees* and *understands* web pages — the same way a human does. By combining Gemini's Computer-Use model for visual reasoning, Groq for sub-second intent parsing, and Browserbase for scalable cloud execution, it delivers a framework where users simply describe what they want in plain English and the system handles the rest.

The self-correcting intelligence layer — with stuck-loop detection, duplicate-action guards, and auto-submit logic — addresses the core reliability challenges that make traditional AI automation fragile. Meanwhile, the real-time dashboard provides full transparency into every step, making it suitable for both development and production monitoring.

While limitations remain around authentication, complex form interactions, and API costs at scale, this architecture establishes a strong foundation for the next generation of autonomous web agents — where natural language is the only interface you need.

---

<p align="center">
  Built with ❤️ using <strong>Google Gemini</strong>, <strong>Browserbase</strong>, <strong>Groq</strong> & <strong>React</strong>
</p>
