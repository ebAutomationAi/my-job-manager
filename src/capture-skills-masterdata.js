#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_OUTPUT_DIR = path.join(__dirname, '../debug-output');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acceptCookies(page) {
  const cookieSelectors = [
    'button[id*="accept"]',
    'button[id*="cookie"]',
    'button[class*="accept"]',
    'button[class*="cookie"]',
    'button[class*="consent"]',
    'button[id*="consent"]',
    '#onetrust-accept-btn-handler',
    '#acceptAllButton',
    '.cookie-accept',
    '[data-testid*="cookie"] button',
    'button:has-text("Aceptar")',
    'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar todo")',
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("Permitir")',
    'button:has-text("Permitir todas")',
  ];

  for (const selector of cookieSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(1500);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function captureSkillsMasterdata() {
  console.log('\n📋 Capturando opciones de Habilidades desde Manpower\n');
  console.log('='.repeat(70));

  if (!fs.existsSync(DEBUG_OUTPUT_DIR)) {
    fs.mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });
  }

  let skillsData = null;
  const capturePromise = new Promise((resolve) => {
    const browser = chromium.launch({ headless: false }).then(async (b) => {
      const context = await b.newContext({ userAgent: USER_AGENT });
      const page = await context.newPage();

      let responseReceived = false;

      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('GetSkillsMasterdata')) {
          console.log(`\n✅ Respuesta capturada: ${url}`);
          try {
            const data = await response.json();
            skillsData = data;
            responseReceived = true;
            console.log(`   Opciones recibidas: ${data?.length || 0} items`);
            resolve({ success: true, data });
          } catch (error) {
            console.error(`   ❌ Error al parsear JSON: ${error.message}`);
            resolve({ success: false, error: error.message });
          }
        }
      });

      try {
        console.log('\n🔍 Navegando a https://www.manpower.es/es/mi-cuenta/crea-tu-perfil...');
        await page.goto('https://www.manpower.es/es/mi-cuenta/crea-tu-perfil', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await delay(2000);

        console.log('   Aceptando cookies...');
        await acceptCookies(page);

        console.log('\n📝 INSTRUCCIONES:');
        console.log('   1. Si se solicita, inicia sesión como candidato.');
        console.log('   2. Navega hasta el campo "Habilidades" (skills).');
        console.log('   3. Abre el desplegable (haz clic en el campo).');
        console.log('   4. El script capturará automáticamente la respuesta de red.');
        console.log('   5. Espera hasta que se imprima "✅ Respuesta capturada".\n');

        console.log('⏱️  Esperando captura (máximo 5 minutos)...');

        await new Promise((res) => {
          setTimeout(() => {
            if (!responseReceived) {
              console.error('\n❌ Timeout: No se recibió la respuesta de GetSkillsMasterdata.');
              res();
            }
          }, 5 * 60 * 1000);
        });

        await delay(1000);
        await page.close();
        await context.close();
        await b.close();
      } catch (error) {
        console.error(`\n❌ Error en navegación: ${error.message}`);
        try {
          await page.close();
          await context.close();
          await b.close();
        } catch {}
        resolve({ success: false, error: error.message });
      }
    });
  });

  const result = await capturePromise;

  if (result.success && skillsData) {
    const outputPath = path.join(DEBUG_OUTPUT_DIR, 'skills-masterdata.json');
    fs.writeFileSync(outputPath, JSON.stringify(skillsData, null, 2));
    console.log(`\n💾 Datos guardados en: ${outputPath}`);

    printSummary(skillsData);
  } else if (!result.success) {
    console.error(`\n❌ Fallo en captura: ${result.error}`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

function printSummary(data) {
  console.log('\n📊 RESUMEN DE OPCIONES:\n');

  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('   (sin opciones)');
      return;
    }

    const sampleKeys = Object.keys(data[0]);
    console.log(`   Estructura: ${sampleKeys.join(', ')}\n`);

    data.slice(0, 10).forEach((item, idx) => {
      const label = item.name || item.label || item.value || item.id || '?';
      console.log(`   ${idx + 1}. ${label}`);
    });

    if (data.length > 10) {
      console.log(`\n   ... y ${data.length - 10} más (ver skills-masterdata.json)`);
    }
  } else if (data && typeof data === 'object') {
    const skillsArray = data.skills || data.data || data.options || data.items || [];
    if (Array.isArray(skillsArray) && skillsArray.length > 0) {
      console.log(`   Estructura: ${Object.keys(skillsArray[0]).join(', ')}\n`);
      skillsArray.slice(0, 10).forEach((item, idx) => {
        const label = item.name || item.label || item.value || item.id || '?';
        console.log(`   ${idx + 1}. ${label}`);
      });
      if (skillsArray.length > 10) {
        console.log(`\n   ... y ${skillsArray.length - 10} más (ver skills-masterdata.json)`);
      }
    } else {
      console.log('   (estructura JSON capturada pero sin array de opciones claro)');
    }
  }
}

captureSkillsMasterdata().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
