const { app, BrowserWindow, shell, dialog } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const crypto = require('crypto');

const APP_NAME = 'L7ssab Manager';
app.setName(APP_NAME);

// يمنع تشغيل أكثر من نسخة واحدة من التطبيق في آن واحد. ضروري هنا تحديداً: كل نسخة
// تحاول ربط نفس منفذ الخادم الخلفي الثابت (34115 — راجع BACKEND_PORT أدناه) وفتح
// نفس ملف قاعدة بيانات SQLite في userData. بدون هذا القفل، تشغيل نسخة ثانية (مثلاً
// نسخة مثبَّتة من Program Files ونسخة أخرى محمولة/تطويرية في آن واحد) يجعل الخادم
// الخلفي للنسخة الثانية يفشل في الاستماع على المنفذ فوراً ويتعطل — وهو أخطر من مجرد
// رسالة عطل: نسختان تكتبان في نفس ملف SQLite في آن واحد قد تُفسدان البيانات فعلياً
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  const [existingWindow] = BrowserWindow.getAllWindows();
  if (existingWindow) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.focus();
  }
});

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

// المفتاح العلني فقط (المرحلة 12 — التحقق من التراخيص) — المفتاح الخاص المطابق له
// لا يوجد في هذا المشروع إطلاقاً، راجع license-tool/ في جذر المستودع
function licensePublicKeyPath() {
  return app.isPackaged
    ? path.join(RES_ROOT, 'license-public-key.pem')
    : path.join(__dirname, 'resources', 'license-public-key.pem');
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

// يُستدعى قبل ensureDatabase: يطبّق نسخة احتياطية طلب المستخدم استعادتها (راجع
// backend/src/backup/backup.service.ts) — لا يمكن استبدال قاعدة البيانات الحية
// بينما الخادم الخلفي متصل بها، لذا يكتب الخادم علامة عند طلب الاستعادة ثم يطلب
// إعادة تشغيل التطبيق بأكمله (app.relaunch)؛ هذه الدالة تُطبَّق فقط عند إعادة
// التشغيل التالية، قبل أن يبدأ أي اتصال جديد بقاعدة البيانات
function applyPendingRestore(userDataPath) {
  const marker = path.join(userDataPath, 'restore-pending.db');
  if (!fs.existsSync(marker)) return;

  const dbPath = path.join(userDataPath, 'pharma-manager.db');
  fs.copyFileSync(marker, dbPath);
  fs.unlinkSync(marker);

  // حذف ملفات SQLite الجانبية المتبقية من قاعدة البيانات القديمة (وضع WAL) —
  // تركها قد يجعل SQLite يحاول دمج إطارات WAL قديمة غير متوافقة مع الملف الجديد
  for (const suffix of ['-journal', '-wal', '-shm']) {
    const sidecar = dbPath + suffix;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
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

// يمنع نمو backend.log بلا حدود على تثبيت طويل الأمد عند عميل حقيقي — لا توجد
// فرقة عمليات تراقب مساحة القرص، فيُعاد تسمية الملف القديم كسجل احتياطي واحد
// بدل تراكم سجلات لا نهائية
const MAX_LOG_BYTES = 5 * 1024 * 1024;

function rotateLogIfLarge(logPath) {
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_BYTES) {
      const rotatedPath = `${logPath}.old`;
      if (fs.existsSync(rotatedPath)) fs.unlinkSync(rotatedPath);
      fs.renameSync(logPath, rotatedPath);
    }
  } catch {
    // فشل التدوير ليس سبباً كافياً لمنع بدء التطبيق — سيُتابَع الكتابة على الملف كما هو
  }
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
// يمنع معالج 'exit' أدناه من معاملة الخروج المتعمّد (بسبب استعادة نسخة احتياطية
// أو إغلاق طبيعي للتطبيق) كأنه عطل غير متوقع في الخادم الخلفي
let backendExitExpected = false;

function startBackend({ dbPath, port, frontendPort, jwtSecret, userDataPath, logPath }) {
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
    // يجب أن يشمل منفذ الواجهة الفعلي (frontendPort، يُختار عشوائياً عبر getFreePort()
    // عند كل تشغيل) وليس فقط منفذ الخادم الخلفي الثابت — نافذة Electron تُحمَّل من
    // frontendPort، فهو Origin الفعلي لأي طلب fetch من الواجهة. إبقاء منفذ الخادم
    // الخلفي في القائمة أيضاً للحفاظ على وصول أدوات مثل /api/docs مباشرة على 34115
    CORS_ORIGIN: `http://localhost:${port},http://127.0.0.1:${port},http://localhost:${frontendPort},http://127.0.0.1:${frontendPort}`,
    PUBLIC_URL: `http://127.0.0.1:${port}`,
    PUPPETEER_CACHE_DIR: puppeteerCacheDir(),
    STORAGE_PROVIDER: 'local',
    NODE_ENV: 'production',
    LICENSE_PUBLIC_KEY_PATH: licensePublicKeyPath(),
  };

  rotateLogIfLarge(logPath);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const child = fork(backendMainPath(), [], {
    cwd: userDataPath,
    env,
    silent: true,
  });
  child.stdout?.on('data', (d) => logStream.write(d));
  child.stderr?.on('data', (d) => logStream.write(d));

  // راجع backend/src/backup/backup.service.ts: يرسل هذه الرسالة عبر قناة fork()
  // الداخلية بعد كتابة علامة الاستعادة، فتُعيد Electron تشغيل نفسها بالكامل —
  // هذا يضمن عدم وجود أي اتصال Prisma مفتوح عند تطبيق الاستعادة عند الإقلاع التالي
  child.on('message', (msg) => {
    if (msg && msg.type === 'restore-requested') {
      backendExitExpected = true;
      app.relaunch();
      app.exit(0);
    }
  });

  return child;
}

// يُستدعى فقط بعد أن يجتاز الخادم فحص الصحة بنجاح (waitForHealth) — أثناء بدء
// التشغيل نفسه، فشل الخادم يُعالَج أصلاً برسالة واحدة واضحة عبر try/catch في
// whenReady؛ ربط هذا المعالج مبكراً جداً كان يسبب ظهور رسالتي خطأ متتاليتين
// لنفس العطل عندما يفشل الخادم قبل أن يصبح جاهزاً
function watchForUnexpectedExit(child, logPath) {
  child.on('exit', (code, signal) => {
    if (backendExitExpected) return;
    dialog.showErrorBox(
      'توقف الخادم الخلفي بشكل غير متوقع',
      `رمز الخروج: ${code ?? 'غير معروف'} ${signal ? `(إشارة: ${signal})` : ''}\nراجع سجل الأخطاء في: ${logPath}`,
    );
    app.quit();
  });
}

// أُضيف بعد إعادة إنتاج عطل حقيقي على هذا الجهاز: أول تشغيل للتطبيق مباشرة بعد
// تثبيته عبر المثبّت كان يفشل أحياناً بخطأ MODULE_NOT_FOUND رغم أن الملف موجود
// فعلياً على القرص، ثم ينجح بلا أي تغيير عند إعادة المحاولة فوراً — يطابق سلوك
// فحص Windows Defender الفوري لملفات .js الكثيرة التي يكتبها المثبّت لتوّه، والذي
// قد يمنع عملية أخرى (هنا: fork() الخاص بـ Electron) من قراءتها للحظات قصيرة.
// إعادة محاولة قصيرة تمتص هذا التأخير العابر بدل إظهار رسالة عطل مخيفة من أول تشغيل
async function startBackendWithRetry(opts, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const child = startBackend(opts);
    try {
      const isLastAttempt = attempt === maxAttempts;
      await waitForHealth(BACKEND_PORT, isLastAttempt ? 20000 : 6000);
      return child;
    } catch (error) {
      lastError = error;
      child.kill();
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
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

  // مسارات ديناميكية (مثال: /suppliers/<id> بعد إنشائه في وقت التشغيل) لا تملك ملف
  // HTML مبنيّ مسبقاً باسمها الحقيقي — الواجهة تُصدَّر بـ generateStaticParams يعيد
  // معرّفاً وهمياً واحداً فقط (`placeholder`، راجع مثلاً app/(app)/suppliers/[id]/page.tsx)
  // لأن next export لا يمكنه معرفة كل المعرّفات التي ستُنشأ لاحقاً في قاعدة بيانات
  // العميل. ملف placeholder.html هذا هو نفس React shell لأي قيمة معرّف حقيقية —
  // useParams() يبقى عالقاً على 'placeholder' حتى بعد تنقّل حقيقي من جانب العميل (تأكَّد
  // هذا فعلياً، وليس افتراضاً)، لذا يقرأ المكوّن الفعلي (page-client.tsx) المعرّف من مسار
  // المتصفح مباشرة (راجع src/lib/use-route-id.ts) بدل الاعتماد على حالة الموجّه. عند فشل
  // تطابق مسار مباشر هنا في الخادم، نجرّب استبدال كل جزء من المسار (بدءاً من الأقرب
  // للنهاية) بكلمة "placeholder" ونعيد المحاولة — إن وُجد ملف مطابق نخدمه، فهو الغلاف
  // الصحيح لهذا المسار الديناميكي.
  function resolveFilePath(urlPath) {
    const direct = path.join(rootDir, urlPath);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

    const withHtml = `${direct}.html`;
    if (fs.existsSync(withHtml)) return withHtml;

    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
      const indexHtml = path.join(direct, 'index.html');
      if (fs.existsSync(indexHtml)) return indexHtml;
    }

    const segments = urlPath.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i] === 'placeholder') continue;
      const candidateSegments = [...segments];
      candidateSegments[i] = 'placeholder';
      const candidatePath = `/${candidateSegments.join('/')}`;
      const candidateHtml = path.join(rootDir, `${candidatePath}.html`);
      if (fs.existsSync(candidateHtml)) return candidateHtml;
      const candidateIndex = path.join(rootDir, candidatePath, 'index.html');
      if (fs.existsSync(candidateIndex)) return candidateIndex;
    }

    return path.join(rootDir, '404.html');
  }

  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = requestPath === '/' ? path.join(rootDir, 'index.html') : resolveFilePath(requestPath);

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
      // يمنع الوصول لأدوات المطوّر (F12 وغيره) في النسخة المُعبّأة النهائية —
      // تبقى متاحة في وضع التطوير (electron .) للتشخيص
      devTools: !app.isPackaged,
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
    applyPendingRestore(userDataPath);
    const dbPath = ensureDatabase(userDataPath);
    const jwtSecret = ensureJwtSecret(userDataPath);
    const frontendPort = await getFreePort();

    backendProcess = await startBackendWithRetry({
      dbPath,
      port: BACKEND_PORT,
      frontendPort,
      jwtSecret,
      userDataPath,
      logPath: path.join(userDataPath, 'backend.log'),
    });

    watchForUnexpectedExit(backendProcess, path.join(userDataPath, 'backend.log'));
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
  backendExitExpected = true;
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  backendExitExpected = true;
  if (backendProcess) backendProcess.kill();
});

// شبكة أمان أخيرة: خطأ متزامن غير متوقع في العملية الرئيسية لـ Electron (خارج
// try/catch الموجود في whenReady) كان سيتسبب في إغلاق صامت بلا أي رسالة للمستخدم
process.on('uncaughtException', (error) => {
  dialog.showErrorBox('خطأ غير متوقع', String(error && error.stack ? error.stack : error));
  app.exit(1);
});
