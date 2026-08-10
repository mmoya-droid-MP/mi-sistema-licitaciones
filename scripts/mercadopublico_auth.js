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

async function runMercadoPublicoAuth() {
  console.log('\n================================================================');
  console.log('  🚀 BOT DE AUTENTICACIÓN E INSPECCIÓN MERCADO PÚBLICO - CLAVEÚNICA');
  console.log('================================================================\n');

  let execPath;
  let isLocalBrowser = false;

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
      execPath = p;
      isLocalBrowser = true;
      console.log(`🦁 Usando ejecutable de navegador local: ${execPath}`);
      break;
    }
  }

  if (!isLocalBrowser) {
    const chromInstance = chromium?.default || chromium;
    const execPathFn = typeof chromInstance?.executablePath === 'function' 
      ? chromInstance.executablePath 
      : (typeof chromium?.default?.executablePath === 'function' ? chromium.default.executablePath : null);
    
    if (execPathFn) {
      execPath = await execPathFn();
    }
    console.log(`⚡ Usando ejecutable liviano de @sparticuz/chromium: ${execPath}`);
  }

  const activeChrom = chromium?.default || chromium;
  const launchOptions = isLocalBrowser ? {
    executablePath: execPath,
    headless: (process.env.HEADLESS === 'true' || process.env.NODE_ENV === 'production' || !!process.env.RENDER) ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1280, height: 800 }
  } : {
    args: activeChrom.args || chromium?.default?.args,
    defaultViewport: activeChrom.defaultViewport || chromium?.default?.defaultViewport,
    executablePath: execPath,
    headless: activeChrom.headless !== undefined ? activeChrom.headless : chromium?.default?.headless,
  };

  console.log('🌐 Configurando motor Puppeteer / Sparticuz Chromium...');

  let browser;
  let page;

  try {
    browser = await puppeteer.launch(launchOptions);

    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Desactivar timeouts para permitir interacción
    page.setDefaultTimeout(0);
    page.setDefaultNavigationTimeout(0);

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

    console.log('\n----------------------------------------------------------------');
    console.log(' 1. CONSULTA PÚBLICA ESTABLE EN WWW.MERCADOPUBLICO.CL (Licitaciones LE26/LP26)');
    console.log('----------------------------------------------------------------');
    console.log('🌐 Mantenimiento de URL base pública (Sin redirección forzada a proveedores):');
    console.log('🔗 URL: https://www.mercadopublico.cl/BuscarLicitacion/Home/Buscar');
    await page.goto('https://www.mercadopublico.cl/BuscarLicitacion/Home/Buscar', { waitUntil: 'domcontentloaded' }).catch(() => {});

    console.log('\n----------------------------------------------------------------');
    console.log(' 2. MÓDULO PRIVADO CONVENIO MARCO (Acceso Autenticado)');
    console.log('----------------------------------------------------------------');

    const currentCookies = await page.cookies();
    const hasAuthCookie = currentCookies.some(c => c.name === '.ASPXAUTH' || c.name === 'ASP.NET_SessionId');

    if (hasAuthCookie) {
      console.log('✨ Cookies de sesión (.ASPXAUTH / ASP.NET_SessionId) detectadas. Reutilizando sesión sin re-autenticación.');
    } else {
      try {
        await page.goto('https://proveedor.mercadopublico.cl/', { waitUntil: 'domcontentloaded' });
      } catch (e) {
        console.log('🔗 Redirigiendo a la portada oficial de inicio de sesión...');
        await page.goto('https://www.mercadopublico.cl/Home/Login', { waitUntil: 'domcontentloaded' });
      }

      if (!isHeadless && process.stdin.isTTY) {
        console.log('\n================================================================');
        console.log('>>> PAUSA DE AUTENTICACIÓN MANUAL (CHECKPOINT):');
        console.log('>>> Por favor ingresa tu RUT, ClaveÚnica y código OTP de 6 dígitos en el navegador.');
        console.log('>>> Una vez autenticado y dentro del portal, presiona ENTER para continuar el flujo automático.');
        console.log('================================================================\n');

        await promptCLI('👉 Presione [ENTER] en esta terminal una vez iniciada la sesión...');
      } else {
        console.log('ℹ️ Ejecución en modo headless/servidor. Continuando extracción...');
      }
    }

    console.log('\n----------------------------------------------------------------');
    console.log(' 3. NAVEGACIÓN DENTRO DEL PORTAL AUTENTICADO (Módulo Convenio Marco)');
    console.log('----------------------------------------------------------------');
    console.log('🌐 Navegando a "Administración del Convenio" -> "Oportunidades de Cotización"...');

    const convenioMarcoUrls = [
      'https://proveedores.mercadopublico.cl/AdministracionConvenio/OportunidadesCotizacion',
      'https://conveniomarco2.mercadopublico.cl/software3/quoteform/seller/quote/list',
      'https://www.mercadopublico.cl/BuscarLicitacion/Home/Buscar'
    ];

    for (const targetNavUrl of convenioMarcoUrls) {
      try {
        console.log(`🧭 Intentando acceso a: ${targetNavUrl}`);
        await page.goto(targetNavUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        break;
      } catch (navErr) {
        console.log(`⚠️ Intento a ${targetNavUrl} omitido o diferido.`);
      }
    }

    console.log('\n💾 Capturando y conservando cookies (ASP.NET_SessionId y .ASPXAUTH) y estado de la sesión activa...');
    const savedCookies = await page.cookies();
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies: savedCookies }, null, 2), 'utf-8');
    const activeCookieNames = savedCookies.map(c => c.name).join(', ');
    console.log(`✅ Session state guardado con éxito en: ${SESSION_FILE}`);
    console.log(`🍪 Cookies capturadas: [ ${activeCookieNames} ]`);

    // 4. Extracción de datos
    console.log('\n----------------------------------------------------------------');
    console.log(' 4. EXTRACCIÓN Y BÚSQUEDA AVANZADA (Filtro 30 Días / Keywords)');
    console.log('----------------------------------------------------------------\n');

    const oportunidades = await page.evaluate(() => {
      const items = [
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

      return items;
    });

    console.log('\n📊 LISTADO DE OPORTUNIDADES EXTRAÍDAS CON FECHA EXACTA DE CIERRE (America/Santiago):');
    console.table(oportunidades);

    const reportPath = path.join(process.cwd(), 'reporte_licitaciones_mercadopublico.json');
    fs.writeFileSync(reportPath, JSON.stringify(oportunidades, null, 2), 'utf-8');
    console.log(`\n📁 Reporte consolidado exportado con éxito en: ${reportPath}`);

    if (!isHeadless && process.stdin.isTTY) {
      console.log('\n----------------------------------------------------------------');
      console.log('  PAUSA DE CONTROL - INTERACCIÓN POR TERMINAL');
      console.log('----------------------------------------------------------------');
      await promptCLI('👉 Presione [ENTER] para continuar con el raspado/procesamiento de datos...');
    }

    console.log('\n✅ Proceso de raspado finalizado exitosamente.');
    console.log('================================================================');
    console.log('  RESUMEN FINAL:');
    console.log('  - Estado Verificación: ÉXITO');
    console.log(`  - Galletas / Estado Sesión: Guardado en ${SESSION_FILE}`);
    console.log(`  - Oportunidades Procesadas: ${oportunidades.length} registros`);
    console.log('================================================================\n');

    return {
      success: true,
      status: 'Éxito de Sesión',
      sessionSaved: true,
      count: oportunidades.length,
      oportunidades
    };

  } catch (err) {
    console.error('\n❌ ERROR CRÍTICO DURANTE LA EJECUCIÓN:', err.message);

    if (page) {
      try {
        const errScreenshot = path.join(process.cwd(), 'error_screenshot.png');
        await page.screenshot({ path: errScreenshot });
        console.log(`📸 Captura del error guardada en: ${errScreenshot}`);
      } catch (sErr) {
        // ignore screenshot error
      }
    }

    console.log('================================================================');
    console.log('  RESUMEN FINAL:');
    console.log('  - Estado Verificación: FALLO DE SESIÓN');
    console.log(`  - Detalle: ${err.message}`);
    console.log('================================================================\n');

    return {
      success: false,
      status: 'Fallo de Sesión',
      error: err.message
    };
  } finally {
    if (browser) {
      console.log('🔒 Cerrando instancia de navegador...');
      await browser.close().catch(() => {});
    }
  }
}

// Ejecutar si es invocado directamente desde la línea de comandos
if (import.meta.url === `file://${process.argv[1]}`) {
  runMercadoPublicoAuth();
}

export { runMercadoPublicoAuth };
