# Soul Link Desktop — MVP Feature Completion Checklist

> **For Claude Code. Check each item — some may already be partially implemented. Complete or fix as needed.**
> **Priority: Fix bugs first (1, 5, 6), then features (2, 3, 4).**

---

## 1. Fix Startup Flow — Card Import + Connection Status

### Problem
- `/rp import-card` returns "already exists in this channel" but worker treats it as failure
- UI shows "未连接" even when WebSocket is connected and gateway responds
- Input box stuck on "等待连接..." — session never marked ready

### Required Changes

**electron/bridge/worker.ts** — Fix import step response handling:
```
In the startup sequence, step where /rp import-card response is checked:

Current (broken): only checks for "✅" as success
Fix: treat these responses as success and continue to /rp start:
  - contains "✅" → import succeeded, continue
  - contains "already exists" → card already imported, skip to /rp start
  - contains "❌" → real error, stop and report

After /rp start succeeds, MUST emit session ready event via IPC:
  mainWindow.webContents.send('bridge:session', { ready: true, card: '<card_name>' })
```

**src/stores/chatStore.ts** — Handle session ready:
```
When bridge:session { ready: true } is received:
  - Set isConnected = true
  - Set isSessionReady = true  
  - Input placeholder changes from "等待连接..." to input placeholder (use i18n key)
  - Enable send button
```

**src/chat/ChatWindow.tsx** — Connection indicator:
```
Status dot in header:
  - Gray + "未连接": WebSocket not connected
  - Yellow + "连接中...": WebSocket connected, session starting
  - Green + "已连接": session ready, can chat
  
Read state from chatStore.isConnected and chatStore.isSessionReady
```

### Verification
- Start app with card already imported on server → no error, status turns green, can chat
- Start app fresh (no card on server) → imports card, starts session, status turns green
- Kill gateway while app running → status turns gray, input disabled

---

## 2. Sprite Placeholder (No Sprite Available State)

### Problem
Pet window needs to gracefully handle missing sprite assets.

### Check If Exists
Look at `src/pet/PetCanvas.tsx` — does it already handle the case where `res/sprites/<character>/frames/` is empty or `manifest.json` is missing?

### Required Implementation

**src/pet/PetCanvas.tsx** — Add placeholder state:
```typescript
// On mount, check if sprite assets exist
// If manifest.json missing or frames/ empty:
//   → Don't render canvas animation
//   → Show placeholder UI instead

// Placeholder UI:
// - 256x256 area (or configurable size)
// - Dashed border (2px dashed rgba(255,255,255,0.3))
// - Centered text: t('pet.placeholder') → "等待角色立绘..."
// - Semi-transparent background: rgba(0,0,0,0.1)
// - Rounded corners: 16px

// When sprites become available (future: hot-reload or app restart):
//   → Switch to normal canvas rendering
```

**Toolbar must still render below the placeholder.** The placeholder takes the same space the sprite canvas would.

### Verification
- Delete/rename `res/sprites/baiyuan/` → app shows placeholder + toolbar works
- Restore sprites → app shows animation (may need restart)

---

## 3. Floating Toolbar (Pet Dock)

### Check If Exists
Look for `src/toolbar/Toolbar.tsx` or similar. May already be scaffolded.

### Required Implementation

**Create/complete these files:**
```
src/toolbar/
├── Toolbar.tsx           # Main toolbar component
├── ToolbarItem.tsx       # Single icon button with tooltip
└── toolbar.module.css    # Styling
```

**Toolbar.tsx:**
```typescript
// Horizontal row of circular icon buttons, centered below pet sprite/placeholder
// Background: semi-transparent frosted glass
//   background: rgba(255, 255, 255, 0.15)
//   backdrop-filter: blur(10px)
//   border-radius: 20px
//   border: 1px solid rgba(255, 255, 255, 0.2)
//
// Items (left to right):
// 1. 💬 Chat    → ipcRenderer.invoke('window:toggle-chat')     [functional]
// 2. ⚙️ Settings → ipcRenderer.invoke('window:open-settings')  [functional]
// 3. 🎭 Character → show tooltip t('toolbar.comingSoon')        [placeholder]
// 4. 📷 Photo    → show tooltip t('toolbar.comingSoon')         [placeholder]
//
// Icon size: 32x32, gap: 6px, padding: 4px 8px
// Hover: scale(1.15) + brighter background
// Active: scale(0.95)
// Tooltip: appears above icon on hover, dark background, 12px font
```

**ToolbarItem.tsx:**
```typescript
interface ToolbarItemProps {
  icon: string;          // emoji or icon component
  label: string;         // i18n key for tooltip
  onClick?: () => void;  // click handler (undefined = disabled/coming soon)
  disabled?: boolean;
}

// If disabled or no onClick: show t('toolbar.comingSoon') tooltip on hover
// If enabled: show label tooltip on hover, call onClick on click
```

**IPC channels** — Add to `electron/ipc.ts` if not present:
```typescript
WINDOW_TOGGLE_CHAT: 'window:toggle-chat',
WINDOW_OPEN_SETTINGS: 'window:open-settings',
```

**electron/main.ts** — Handle these IPC calls:
```typescript
ipcMain.handle('window:toggle-chat', () => {
  // If chat window exists and visible → hide it
  // If chat window exists and hidden → show it
  // If chat window doesn't exist → create it
})

ipcMain.handle('window:open-settings', () => {
  // If settings window exists → focus it
  // If doesn't exist → create it
})
```

**Pet window layout** — Toolbar renders inside pet window:
```tsx
// In pet window's renderer entry (could be PetApp.tsx or similar)
function PetApp() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <PetCanvas />    {/* or placeholder */}
      <Toolbar />      {/* always visible */}
    </div>
  )
}
```

**Click-through handling:**
```typescript
// Pet window is transparent + click-through by default
// But toolbar must be clickable
//
// In pet window renderer, track mouse position:
// - Over toolbar element → ipc send 'pet:set-clickthrough' false
// - Over sprite pixels (check canvas alpha) → ipc send 'pet:set-clickthrough' false  
// - Over transparent area → ipc send 'pet:set-clickthrough' true
//
// In main process:
// ipcMain.on('pet:set-clickthrough', (_, ignore) => {
//   petWindow.setIgnoreMouseEvents(ignore, { forward: true })
// })
//
// Debounce the IPC calls to avoid flooding (only send on state change)
```

### Verification
- Toolbar visible below pet sprite (or placeholder)
- Hover shows tooltips
- Click 💬 → chat window toggles
- Click ⚙️ → settings window opens
- Click 🎭 or 📷 → "即将推出" tooltip
- Click on transparent area around pet → clicks pass through to desktop
- Click on toolbar → does NOT pass through

---

## 4. Internationalization (i18n) Systemization

### Check If Exists
Look for `src/i18n/` directory, `i18next` in package.json, or any existing i18n setup.

### Required Implementation

**Install (if not present):**
```bash
npm install i18next react-i18next
```

**Create/complete:**
```
src/i18n/
├── index.ts       # i18next init config
├── zh-CN.json     # Simplified Chinese (primary)
└── en.json        # English
```

**src/i18n/index.ts:**
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh-CN.json';
import en from './en.json';

// Default language should be read from settings
// Fallback: try navigator.language, then 'zh-CN'

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en': { translation: en },
  },
  lng: 'zh-CN',  // Will be overridden by settings on load
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

**Language file keys (minimum required):**
```json
{
  "onboarding": {
    "welcome": "欢迎来到 Soul Link ✨",
    "subtitle": "你的 AI 桌面情感伴侣",
    "selectLanguage": "选择语言",
    "next": "下一步",
    "prev": "上一步",
    "finish": "完成设置",
    "connection": {
      "title": "连接 OpenClaw",
      "gatewayUrl": "Gateway 地址",
      "token": "认证 Token",
      "testConnection": "测试连接",
      "success": "连接成功",
      "failed": "连接失败",
      "testing": "测试中..."
    },
    "character": {
      "title": "选择角色",
      "noCards": "暂无角色卡，请将角色卡文件放入 res/cards/ 目录",
      "selected": "已选择"
    },
    "companion": {
      "title": "伴侣设置",
      "enable": "启用待机主动对话",
      "idleTime": "空闲触发时间",
      "warning": "启用后角色会在空闲时主动与你对话，会产生少量 Token 消耗",
      "minutes_15": "15 分钟",
      "minutes_30": "30 分钟",
      "hour_1": "1 小时",
      "hour_2": "2 小时"
    }
  },
  "toolbar": {
    "chat": "对话",
    "settings": "设置",
    "character": "切换角色",
    "photo": "生成图片",
    "comingSoon": "即将推出"
  },
  "chat": {
    "title": "对话",
    "inputPlaceholder": "输入消息...",
    "send": "发送",
    "connecting": "连接中...",
    "connected": "已连接",
    "disconnected": "未连接",
    "reconnecting": "正在重连...",
    "waitingConnection": "等待连接...",
    "sessionStarting": "会话启动中..."
  },
  "pet": {
    "placeholder": "等待角色立绘...",
    "noSprite": "请添加角色精灵图到 res/sprites/ 目录"
  },
  "settings": {
    "title": "设置",
    "tabs": {
      "connection": "连接",
      "character": "角色",
      "companion": "伴侣",
      "about": "关于"
    },
    "connection": {
      "status": "连接状态",
      "connected": "已连接",
      "disconnected": "未连接",
      "reconnect": "重新连接",
      "gatewayUrl": "Gateway 地址",
      "token": "认证 Token",
      "testConnection": "测试连接"
    },
    "character": {
      "current": "当前角色",
      "switch": "切换角色",
      "noCards": "暂无角色卡"
    },
    "companion": {
      "enable": "启用待机主动对话",
      "idleTime": "空闲触发时间",
      "mode": "对话模式",
      "modes": {
        "balanced": "均衡",
        "checkin": "关心问候",
        "question": "主动提问",
        "report": "状态报告"
      }
    },
    "about": {
      "version": "版本",
      "resetOnboarding": "重新运行初始化引导",
      "resetConfirm": "确定要重置吗？应用将重新启动"
    }
  },
  "common": {
    "ok": "确定",
    "cancel": "取消",
    "save": "保存",
    "close": "关闭",
    "error": "错误",
    "loading": "加载中..."
  }
}
```

**Create en.json with English translations for all the same keys.**

**Scan ALL existing components and replace hardcoded strings:**
```typescript
// BEFORE (scattered hardcoded text):
<span>未连接</span>
<input placeholder="等待连接..." />
<button>下一步</button>

// AFTER (i18n):
const { t } = useTranslation();
<span>{t('chat.disconnected')}</span>
<input placeholder={t('chat.waitingConnection')} />
<button>{t('onboarding.next')}</button>
```

**Important: scan EVERY .tsx file in src/ for Chinese or English hardcoded strings.**
Common places to check:
- Button text
- Placeholder text
- Tooltip text
- Status labels
- Error messages
- Window titles
- Header text

**Language switch must work at runtime:**
```typescript
import { useTranslation } from 'react-i18next';
const { i18n } = useTranslation();
// On language change:
i18n.changeLanguage('en');
// Also save to settings:
ipcRenderer.invoke('settings:set', { key: 'ui.language', value: 'en' });
```

### Verification
- Switch to English in onboarding step 1 → all subsequent steps show English
- Switch to Chinese → all text is Chinese
- Restart app → language preference persists
- No hardcoded Chinese or English text remains in any component

---

## 5. Hot Reload Fix — Prevent Multiple Windows

### Problem
Code changes trigger hot reload which opens duplicate Electron windows.

### Check If Exists
Look in `electron/main.ts` for `app.requestSingleInstanceLock()`. Check `package.json` for electronmon config.

### Required Implementation

**electron/main.ts** — Add at the very top (before any other code):
```typescript
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus existing window
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      if (wins[0].isMinimized()) wins[0].restore();
      wins[0].focus();
    }
  });

  // ... rest of app initialization
}
```

**package.json** — Configure electronmon to only watch main process:
```json
{
  "electronmon": {
    "patterns": ["dist-electron/**/*"],
    "logLevel": "quiet"
  }
}
```

**Check dev script** — Ensure renderer HMR doesn't restart Electron:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:vite\" \"npm run dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "wait-on http://localhost:5173 && electronmon ."
  }
}
```

If `concurrently` and `wait-on` are not installed:
```bash
npm install -D concurrently wait-on
```

### Verification
- Edit a React component in src/ → Vite HMR updates in browser, NO Electron restart
- Edit a file in electron/ → Electron restarts, only ONE instance runs
- Never see multiple pet windows or onboarding windows at the same time

---

## 6. Onboarding / Pet Window Serialization

### Problem
Onboarding window and pet window open simultaneously. Should be sequential.

### Check If Exists
Look at `electron/main.ts` app.whenReady() — does it check onboarding state before creating windows?

### Required Implementation

**electron/main.ts** — Startup flow:
```typescript
app.whenReady().then(async () => {
  const settings = loadSettings();
  
  if (!settings.onboarding?.completed) {
    // ONLY create onboarding window
    const onboardingWin = createOnboardingWindow();
    
    // Wait for onboarding to complete
    ipcMain.once('onboarding:complete', () => {
      onboardingWin.close();
      // NOW create pet window + start bridge
      createPetWindow();
      startBridge();
    });
  } else {
    // Onboarding done, go straight to pet
    createPetWindow();
    startBridge();
  }
});
```

**Onboarding window specs:**
```typescript
function createOnboardingWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 640,
    height: 720,
    resizable: false,
    center: true,           // centered on screen
    frame: true,            // normal window frame (not frameless)
    transparent: false,     // normal opaque window
    alwaysOnTop: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  // Load the renderer URL with ?route=onboarding or similar
}
```

**IPC channel** — Add to `electron/ipc.ts`:
```typescript
ONBOARDING_COMPLETE: 'onboarding:complete'
```

**Onboarding wizard finish handler:**
```typescript
// In OnboardingWizard.tsx, when user clicks "完成设置":
const handleFinish = async () => {
  // Save all settings
  await ipcRenderer.invoke('settings:set', { key: 'onboarding.completed', value: true });
  await ipcRenderer.invoke('settings:set', { key: 'onboarding.completedAt', value: new Date().toISOString() });
  // Notify main process
  ipcRenderer.send('onboarding:complete');
};
```

**Bridge connection timing:**
- Do NOT connect to OpenClaw during onboarding (except for the connection test in step 2)
- Bridge connection starts ONLY after pet window is created
- Connection test in onboarding step 2 uses a temporary one-off WebSocket, not the persistent bridge

### Verification
- Delete data/settings.json → start app → ONLY onboarding window appears, no pet window
- Complete onboarding → onboarding closes → pet window appears with toolbar
- Restart app → onboarding does NOT appear, pet window shows directly
- During onboarding, no WebSocket connection to gateway (except step 2 test)

---

## Implementation Order

1. **Item 5** (hot reload fix) — Do this FIRST so development is not disrupted
2. **Item 6** (window serialization) — Fix window lifecycle before adding features
3. **Item 1** (startup flow bug) — Fix bridge worker so chat actually works
4. **Item 4** (i18n) — Systemize before adding more UI text
5. **Item 2** (sprite placeholder) — Visual polish
6. **Item 3** (toolbar) — Feature addition, depends on pet window working correctly
