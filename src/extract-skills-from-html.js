#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, '../manpower.html');
const DEBUG_OUTPUT_DIR = path.join(__dirname, '../debug-output');

async function extractSkillsFromHTML() {
  console.log('\n📋 Extrayendo opciones de Habilidades del HTML guardado\n');
  console.log('='.repeat(70));

  if (!fs.existsSync(HTML_FILE)) {
    console.error(`❌ Archivo no encontrado: ${HTML_FILE}`);
    process.exit(1);
  }

  try {
    const html = fs.readFileSync(HTML_FILE, 'utf-8');

    // Buscar script JSON embebido
    const jsonMatch = html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
    if (!jsonMatch) {
      console.error('❌ No se encontró script JSON embebido en el HTML');
      process.exit(1);
    }

    const jsonStr = jsonMatch[1];
    let jsonData;

    try {
      jsonData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`❌ Error al parsear JSON: ${parseError.message}`);
      process.exit(1);
    }

    console.log('✅ JSON embebido encontrado y parseado');

    // Buscar campos de skills en la estructura
    let skillsData = null;

    // Estrategia 1: buscar en propiedades conocidas
    function searchSkills(obj, depth = 0) {
      if (depth > 10) return null; // Evitar recursión infinita

      if (Array.isArray(obj)) {
        // Buscar arrays que contengan objetos con propiedades de skills
        for (const item of obj) {
          if (item && typeof item === 'object') {
            if (
              (item.id !== undefined && item.name !== undefined) ||
              (item.id !== undefined && item.label !== undefined) ||
              (item.value !== undefined && item.label !== undefined)
            ) {
              // Parece un array de opciones
              return obj;
            }
            const found = searchSkills(item, depth + 1);
            if (found) return found;
          }
        }
      } else if (obj && typeof obj === 'object') {
        // Buscar en propiedades específicas
        const skillsKeys = ['skills', 'masterdata', 'typeOptions', 'options', 'items', 'data'];
        for (const key of skillsKeys) {
          if (obj[key]) {
            const result = searchSkills(obj[key], depth + 1);
            if (result) return result;
          }
        }

        // Buscar en todas las propiedades
        for (const key in obj) {
          const result = searchSkills(obj[key], depth + 1);
          if (result) return result;
        }
      }

      return null;
    }

    skillsData = searchSkills(jsonData);

    if (!skillsData || !Array.isArray(skillsData) || skillsData.length === 0) {
      console.error('❌ No se encontró un array de skills en el JSON');
      console.log('   Estructura encontrada:', JSON.stringify(jsonData, null, 2).substring(0, 500));
      process.exit(1);
    }

    console.log(`✅ Se encontraron ${skillsData.length} opciones de habilidades\n`);

    // Guardar en debug-output
    if (!fs.existsSync(DEBUG_OUTPUT_DIR)) {
      fs.mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });
    }

    const outputPath = path.join(DEBUG_OUTPUT_DIR, 'skills-from-html.json');
    fs.writeFileSync(outputPath, JSON.stringify(skillsData, null, 2));
    console.log(`💾 Datos guardados en: ${outputPath}\n`);

    // Imprimir resumen
    printSummary(skillsData);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70) + '\n');
}

function printSummary(data) {
  console.log('📊 RESUMEN DE OPCIONES:\n');

  if (!Array.isArray(data) || data.length === 0) {
    console.log('   (sin opciones)');
    return;
  }

  const sampleKeys = Object.keys(data[0]);
  console.log(`   Estructura: ${sampleKeys.join(', ')}\n`);

  data.slice(0, 20).forEach((item, idx) => {
    const label = item.name || item.label || item.value || item.id || '?';
    console.log(`   ${idx + 1}. ${label}`);
  });

  if (data.length > 20) {
    console.log(`\n   ... y ${data.length - 20} más (ver skills-from-html.json para la lista completa)`);
  }
}

extractSkillsFromHTML().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
