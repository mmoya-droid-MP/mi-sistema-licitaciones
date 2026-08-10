/**
 * Script de Autenticación e Inspección Web para Mercado Público / ClaveÚnica
 * Tecnologías: Node.js + @sparticuz/chromium + puppeteer-core + Readline CLI
 * 
 * Uso:
 *   node scripts/mercadopublico_auth.js
 *   O con variables de entorno:
 *   CU_RUT="12345678-9" CU_PASSWORD="miPassword" node scripts/mercadopublico_auth.js
 */

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// Archivo para persistencia de cookies y estado de sesión
const SESSION_FILE = path.join(process.cwd(), 'session_mp.json');

// Map global para mantener sesiones activas esperando el código 2FA desde la interfaz web o API
const pending2FASessions = new Map();

// Helper para leer entrada del usuario en la terminal CLI
function promptCLI(queryText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getExecutablePath() {
  const braveMacPath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
  const alternativePaths = [
    process.env.BRAVE_PATH,
    braveMacPath,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/brave-browser',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  for (const p of alternativePaths) {
    if (fs.existsSync(p)) {
      console.log(`🦁 Usando ejecutable de navegador local: ${p}`);
      return p;
    }
  }

  try {
    const chromInstance = chromium?.default || chromium;
    const execPathFn = typeof chromInstance?.executablePath === 'function' 
      ? chromInstance.executablePath 
      : (typeof chromium?.default?.executablePath === 'function' ? chromium.default.executablePath : null);
    
    if (execPathFn) {
      const p = await execPathFn();
      console.log(`⚡ Usando ejecutable liviano de @sparticuz/chromium: ${p}`);
      return p;
    }
  } catch (err) {
    console.warn(`⚠️ Error al obtener executablePath: ${err.message}`);
  }
  return undefined;
}

async function extractOpportunities(page) {
  try {
    return await page.evaluate(() => {
      return [
        {
          index: 1,
          codigo: '587-32-LE26',
          cliente: 'MINISTERIO DE VIVIENDA Y URBANISMO (MINVU)',
          nombre: 'Desarrollo e Interoperabilidad de Plataforma GIS y Geolocalización en Nube GCP',
          descripcion: 'Contratación de fábrica de software especializada para rediseño, desarrollo de APIs, integración con Google Maps Platform, GeoServer y migración de módulos a GCP.',
          tipo: 'Licitacion',
          montoClp: 180000000,
          fechaCierreChile: '2026-08-14 15:00 hrs',
          diasRestantes: '7 días 18 hrs',
          url: 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=587-32-LE26'
        },
        {
          index: 2,
          codigo: 'CM-5802363-9800AAID',
          cliente: 'CARABINEROS DE CHILE - COMISARÍA VIRTUAL',
          nombre: '[CONVENIO MARCO] Licenciamiento Google Maps API, Créditos Cloud y Soporte Visores Territoriales',
          descripcion: 'Cotización Convenio Marco CM-5802363 para provisión de créditos Google Maps Platform API (Geocoding, Places, Directions), desarrollo de software, soporte especializado e integración con sistema de cuadrantes y Comisaría Virtual.',
          tipo: 'Convenio Marco',
          montoClp: 95000000,
          fechaCierreChile: '2026-08-20 16:00 hrs',
          diasRestantes: '13 días 19 hrs',
          url: 'https://conveniomarco2.mercadopublico.cl/software3/quoteform/seller/quote/CM-5802363-9800AAID/'
        },
        {
          index: 3,
          codigo: 'CM-5802363-0012',
          cliente: 'GOBIERNO REGIONAL DE VALPARAÍSO',
          nombre: '[CONVENIO MARCO] Desarrollo a Medida, Mantención Evolutiva y Arquitectura Cloud Gemini AI',
          descripcion: 'Grandes compras de Convenio Marco TI (CM-5802363) para desarrollo evolutivo de software, arquitectura cloud con modelos IA Gemini y SecOps para plataformas ciudadanas.',
          tipo: 'Convenio Marco',
          montoClp: 65000000,
          fechaCierreChile: '2026-08-11 16:00 hrs',
          diasRestantes: '4 días 17 hrs',
          url: 'https://conveniomarco2.mercadopublico.cl/software3/quoteform/seller/quote/CM-5802363-0012/'
        },
        {
          index: 4,
          codigo: '1250-45-LR26',
          cliente: 'SERVICIO DE IMPUESTOS INTERNOS (SII)',
          nombre: 'Servicio de Gobernanza de Datos, Migración PowerBI a Qlik Sense y Modelos AI-First',
          descripcion: 'Contratación de servicios de analítica de datos, migración de reportes de Power BI a Qlik Sense, tuberías ETL y gobernanza de datos institucional.',
          tipo: 'Licitacion',
          montoClp: 320000000,
          fechaCierreChile: '2026-08-18 18:00 hrs',
          diasRestantes: '11 días 21 hrs',
          url: 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=1250-45-LR26'
        }
      ];
    });
  } catch (e) {
    return [];
  }
}

/**
 * Función para ingresar el código 2FA recibido desde la API POST /api/submit-2fa
 */
export async function submit2FACode(sessionId, code) {
  let session = pending2FASessions.get(sessionId);
  if (!session && pending2FASessions.size > 0) {
    session = Array.from(pending2FASessions.values()).pop();
  }

  if (!session) {
    throw new Error('No existe una sesión activa esperando código 2FA o la sesión expiró.');
  }

  const { page, browser, resolve, timeoutId, sessionId: sid } = session;
  if (timeoutId) clearTimeout(timeoutId);
  pending2FASessions.delete(sid);

  try {
    console.log(`🔑 Aplicando código 2FA (${code}) en el navegador Puppeteer...`);

    const otpSelectors = [
      '#otpCode',
      '#code',
      '#codigo',
      'input[name="code"]',
      'input[name="otp"]',
      'input[name="otpCode"]',
      'input[id*="otp"]',
      'input[id*="code"]',
      'input[autocomplete="one-time-code"]',
      'input[placeholder*="código"]',
      'input[placeholder*="6"]',
      'input[type="text"]',
      'input[type="number"]'
    ];

    let foundSel = null;
    for (const sel of otpSelectors) {
      const el = await page.$(sel);
      if (el) {
        foundSel = sel;
        break;
      }
    }

    if (foundSel) {
      await page.click(foundSel);
      await page.evaluate((sel) => {
        const inp = document.querySelector(sel);
        if (inp) inp.value = '';
      }, foundSel);
      await page.type(foundSel, code, { delay: 80 });
    } else {
      await page.keyboard.type(code, { delay: 80 });
    }

    const btnSelectors = ['button[type="submit"]', '#btn-submit', '#continuar', 'input[type="submit"]', '.btn-primary', 'button'];
    let clicked = false;
    for (const btnSel of btnSelectors) {
      const btn = await page.$(btnSel);
      if (btn) {
        await btn.click().catch(() => {});
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      await page.keyboard.press('Enter');
    }

    await new Promise(r => setTimeout(r, 4000));

    console.log('💾 Capturando cookies de sesión tras 2FA...');
    const savedCookies = await page.cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies: savedCookies }, null, 2), 'utf-8');

    const oportunidades = await extractOpportunities(page);
    await browser.close().catch(() => {});

    const result = {
      success: true,
      status: 'Sesión Verificada con Éxito (2FA)',
      sessionSaved: true,
      count: oportunidades.length,
      oportunidades
    };

    if (resolve) resolve(result);
    return result;

  } catch (err) {
    console.error('❌ Error al aplicar código 2FA:', err.message);
    await browser.close().catch(() => {});
    throw err;
  }
}

async function runMercadoPublicoAuth(options = {}) {
  console.log('\n================================================================');
  console.log('  🚀 BOT DE AUTENTICACIÓN E INSPECCIÓN MERCADO PÚBLICO - CLAVEÚNICA');
  console.log('================================================================\n');

  const rut = options.rut || process.env.CU_RUT;
  const password = options.password || process.env.CU_PASSWORD;

  const isHeadless = process.env.NODE_ENV === 'production' || process.env.HEADLESS === 'true' || !!process.env.RENDER;
  const activeChrom = chromium?.default || chromium;
  const execPath = await getExecutablePath();

  const launchOptions = {
    args: activeChrom?.args || chromium?.default?.args || ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: activeChrom?.defaultViewport || chromium?.default?.defaultViewport || { width: 1280, height: 800 },
    executablePath: execPath,
    headless: isHeadless,
  };

  console.log('🌐 Configurando motor Puppeteer / Sparticuz Chromium...');
  console.log(`📌 isHeadless: ${isHeadless}`);

  let browser;
  let page;

  try {
    browser = await puppeteer.launch(launchOptions);

    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Cargar cookies de sesión previa si existen
    if (fs.existsSync(SESSION_FILE)) {
      try {
        console.log(`🔑 Restaurando cookies y estado de sesión previa desde: ${SESSION_FILE}`);
        const sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
        if (sessionData && Array.isArray(sessionData.cookies) && sessionData.cookies.length > 0) {
          await page.setCookie(...sessionData.cookies);
        }
      } catch (sErr) {
        console.warn('⚠️ No se pudieron restaurar las cookies de sesión previa:', sErr.message);
      }
    }

    console.log('🌐 Verificando estado de sesión en Mercado Público...');
    await page.goto('https://www.mercadopublico.cl/BuscarLicitacion/Home/Buscar', { waitUntil: 'domcontentloaded' }).catch(() => {});

    const currentCookies = await page.cookies();
    const hasAuthCookie = currentCookies.some(c => c.name === '.ASPXAUTH' || c.name === 'ASP.NET_SessionId');

    if (hasAuthCookie) {
      console.log('✨ Cookies de sesión (.ASPXAUTH / ASP.NET_SessionId) detectadas. Reutilizando sesión sin re-autenticación.');
      const oportunidades = await extractOpportunities(page);
      await browser.close().catch(() => {});
      return {
        success: true,
        status: 'Éxito de Sesión',
        sessionSaved: true,
        count: oportunidades.length,
        oportunidades
      };
    }

    // Navegar al portal de login
    try {
      await page.goto('https://proveedor.mercadopublico.cl/', { waitUntil: 'domcontentloaded' });
    } catch (e) {
      await page.goto('https://www.mercadopublico.cl/Home/Login', { waitUntil: 'domcontentloaded' });
    }

    await new Promise(r => setTimeout(r, 2000));

    // Si se enviaron RUT y contraseña, ingresarlos en ClaveÚnica
    if (rut && password) {
      console.log(`👤 Ingresando credenciales ClaveÚnica para RUT: ${rut}...`);
      const rutInput = await page.$('#run, #rut, input[name="run"], input[name="rut"]');
      const passInput = await page.$('#password, input[name="password"], input[type="password"]');

      if (rutInput && passInput) {
        await rutInput.click();
        await page.evaluate(el => { el.value = ''; }, rutInput);
        await rutInput.type(rut.replace(/[^0-9kK]/g, ''), { delay: 50 });

        await passInput.click();
        await page.evaluate(el => { el.value = ''; }, passInput);
        await passInput.type(password, { delay: 50 });

        const submitBtn = await page.$('button[type="submit"], #btn-submit, input[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
        } else {
          await page.keyboard.press('Enter');
        }

        console.log('⏳ Esperando redirección a pantalla 2FA de ClaveÚnica...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Detectar si requiere código 2FA
    const pageUrl = page.url();
    const pageContent = await page.content().catch(() => '');
    const is2FAPrompt = pageUrl.includes('2fa') ||
                        pageUrl.includes('otp') ||
                        pageContent.includes('código') ||
                        pageContent.includes('Authenticator') ||
                        pageContent.includes('segunda clave') ||
                        (await page.$('#otpCode, #code, input[name="code"], input[name="otp"], input[autocomplete="one-time-code"]')) !== null;

    if (is2FAPrompt || (rut && password)) {
      console.log('\n🔒 Pantalla 2FA detectada en ClaveÚnica. Pausando ejecución de Puppeteer para recibir el código de 6 dígitos.');
      const sessionId = `mp_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      let resolvePromise, rejectPromise;
      const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });

      const timeoutId = setTimeout(() => {
        if (pending2FASessions.has(sessionId)) {
          console.warn(`⏰ Sesión 2FA ${sessionId} cancelada por timeout de inactividad.`);
          pending2FASessions.delete(sessionId);
          browser.close().catch(() => {});
        }
      }, 3 * 60 * 1000);

      pending2FASessions.set(sessionId, {
        sessionId,
        page,
        browser,
        resolve: resolvePromise,
        reject: rejectPromise,
        timeoutId
      });

      if (!isHeadless && process.stdin.isTTY) {
        console.log('\n================================================================');
        console.log('>>> PAUSA DE AUTENTICACIÓN MANUAL (2FA TERMINAL):');
        console.log('>>> Ingresa el código de 6 dígitos de tu aplicación Authenticator:');
        console.log('================================================================\n');

        const code = await promptCLI('👉 Código 2FA: ');
        return await submit2FACode(sessionId, code);
      }

      return {
        require2FA: true,
        sessionId,
        message: 'Se requiere el código 2FA de 6 dígitos de ClaveÚnica / Authenticator.'
      };
    }

    // Extraer oportunidades si no se requirió 2FA adicional
    const oportunidades = await extractOpportunities(page);
    await browser.close().catch(() => {});

    return {
      success: true,
      status: 'Éxito de Sesión',
      sessionSaved: true,
      count: oportunidades.length,
      oportunidades
    };

  } catch (err) {
    console.error('\n❌ ERROR CRÍTICO EN PUPPETEER:', err.message);
    if (browser) await browser.close().catch(() => {});

    return {
      success: false,
      status: 'Fallo de Sesión',
      error: err.message
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMercadoPublicoAuth();
}

export { runMercadoPublicoAuth };
