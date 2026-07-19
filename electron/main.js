const { app, BrowserWindow, shell, dialog } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');

const APP_NAME = 'Pharma Manager';
app.setName(APP_NAME);

// منفذ ثابت للخادم الخلفي: يجب أن يطابق NEXT_PUBLIC_API_URL المُخبوز داخل تصدير
// الواجهة الثابت وقت البناء (راجع electron/build-frontend-export.js) — لا يمكن اختياره
// ديناميكياً كما في التطوير المحلي، لأن ملفات الواجهة الثابتة لا تُبنى من جديد عند كل تشغيل
const BACKEND_PORT = 34115;

// في وضع التطوير (electron .) تكون الموارد بجانب هذا الملف؛ في النسخة المُعبّأة
// تكون داخل resourcesPath عبر extraResources في تهيئة electron-builder.
const RES_ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');

function backendMainPath() {
  // ملاحظة: مخرجات "nest build" تقع فعلياً في dist/src/main.js وليس dist/main.js —
  // ملف جذري خارج src/ (scratch-test-report-gen.ts) يجعل TypeScript يستنتج rootDir
  // كمجلد backend بأكمله، فيُبقي على مسار src/ داخل dist/. سكريبت start:prod الحالي
  // ("node dist/main") متأثر بهذا أيضاً وقد لا يعمل فعلياً — أمر موجود مسبقاً، لم يتغيّر هنا.
  return app.isPackaged
    ? path.join(RES_ROOT, 'backend', 'src', 'main.js')
    : path.join(__dirname, '..', 'backend', 'dist', 'src', 'main.js');
}

function frontendOutPath() {
  return app.isPackaged ? path.join(RES_ROOT, 'frontend-out') : path.join(__dirname, '..', 'frontend', 'out');
}

// كروميوم الخاص بـ Puppeteer (لتوليد PDF) يُنزَّل خارج node_modules افتراضياً، لذلك
// يُثبَّت في مسار مشروع محلي وقت التطوير (backend/.puppeteer-cache) ويُشحن معه صراحةً
function puppeteerCacheDir() {
  return app.isPackaged
    ? path.join(RES_ROOT, 'backend', '.puppeteer-cache')
    : path.join(__dirname, '..', 'backend', '.puppeteer-cache');
}

function dbTemplatePath() {
  // ملاحظة: process.resourcesPath هو نفسه مجلد resources في النسخة المُعبّأة — لا يُضاف
  // مجلد فرعي إضافي باسم resources هنا
  return app.isPackaged
    ? path.join(RES_ROOT, 'db-template.sqlite')
    : path.join(__dirname, 'resources', 'db-template.sqlite');
}

function iconPath() {
  return app.isPackaged ? path.join(RES_ROOT, 'icon.png') : path.join(__dirname, 'resources', 'icon.png');
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// يُنشئ ملف قاعدة البيانات تلقائياً عند أول تشغيل بنسخ القالب الفارغ (حساب مدير واحد
// فقط، بلا بيانات تجريبية) — العميل يثبّت البرنامج ويبدأ الاستخدام مباشرة دون أي إعداد يدوي
function ensureDatabase(userDataPath) {
  const dbPath = path.join(userDataPath, 'pharma-manager.db');
  if (!fs.existsSync(dbPath)) {
    fs.copyFileSync(dbTemplatePath(), dbPath);
  }
  return dbPath;
}

// سرّ JWT يُولَّد مرة واحدة عند أول تشغيل ويُحفظ محلياً لهذا الجهاز فقط — لا يوجد
// خادم سحابي يوفّره كمتغيّر بيئة كما كان الحال سابقاً في Render
function ensureJwtSecret(userDataPath) {
  const configPath = path.join(userDataPath, 'config.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      config = {};
    }
  }
  if (!config.jwtSecret) {
    config.jwtSecret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  return config.jwtSecret;
}

function waitForHealth(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          retry();
        }
      });
      req.on('error', retry);
      req.on('timeout', () => req.destroy());
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error('انتهت مهلة انتظار تشغيل الخادم الخلفي'));
      setTimeout(attempt, 300);
    };
    attempt();
  });
}

let backendProcess = null;

function startBackend({ dbPath, port, jwtSecret, userDataPath, logPath }) {
  const env = {
    ...process.env,
    // بدون هذا، fork() من داخل العملية الرئيسية لـ Electron يعيد تشغيل ثنائي Electron
    // نفسه بدل تشغيل الملف كعملية Node.js عادية — ضروري خصوصاً في النسخة المُعبّأة حيث
    // لا يوجد ثنائي node منفصل على الإطلاق
    ELECTRON_RUN_AS_NODE: '1',
    DATABASE_URL: `file:${dbPath.replace(/\\/g, '/')}`,
    PORT: String(port),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: '8h',
    CORS_ORIGIN: `http://localhost:${port},http://127.0.0.1:${port}`,
    PUBLIC_URL: `http://127.0.0.1:${port}`,
    PUPPETEER_CACHE_DIR: puppeteerCacheDir(),
    STORAGE_PROVIDER: 'local',
    NODE_ENV: 'production',
  };

  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const child = fork(backendMainPath(), [], {
    cwd: userDataPath,
    env,
    silent: true,
  });
  child.stdout?.on('data', (d) => logStream.write(d));
  child.stderr?.on('data', (d) => logStream.write(d));
  return child;
}

// خادم استاتيكي صغير لتقديم تصدير Next.js الثابت (frontend/out) عبر http محلي بدل
// file:// مباشرة — يتجنّب مشاكل مسارات الأصول المطلقة (/_next/...) تحت بروتوكول الملفات
function startStaticServer(rootDir, port) {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    let filePath = path.join(rootDir, urlPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // مسارات Next.js الثابتة بدون امتداد (مثال: /dashboard) تُخدَّم من dashboard.html
      const withHtml = `${filePath}.html`;
      filePath = fs.existsSync(withHtml) ? withHtml : path.join(rootDir, '404.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function createMainWindow(frontendPort) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: APP_NAME,
    icon: iconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(`http://127.0.0.1:${frontendPort}/login`);
  return win;
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  fs.mkdirSync(userDataPath, { recursive: true });

  try {
    const dbPath = ensureDatabase(userDataPath);
    const jwtSecret = ensureJwtSecret(userDataPath);
    const frontendPort = await getFreePort();

    backendProcess = startBackend({
      dbPath,
      port: BACKEND_PORT,
      jwtSecret,
      userDataPath,
      logPath: path.join(userDataPath, 'backend.log'),
    });

    await waitForHealth(BACKEND_PORT);
    await startStaticServer(frontendOutPath(), frontendPort);

    await createMainWindow(frontendPort);
  } catch (error) {
    dialog.showErrorBox('تعذّر تشغيل التطبيق', String(error && error.stack ? error.stack : error));
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
