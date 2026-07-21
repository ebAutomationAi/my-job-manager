import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROFILES_PATH = resolve(__dirname, '../config/profiles.json');
const CONFIG_PATH = resolve(__dirname, '../config/search-config.json');

let profiles = null;
let config = null;

function loadProfiles() {
  try {
    const profilesData = readFileSync(PROFILES_PATH, 'utf-8');
    return JSON.parse(profilesData);
  } catch (error) {
    console.warn(`Profiles file not found at ${PROFILES_PATH}, using defaults`);
    return {
      ECB: {
        keywords: [],
        match_threshold: 0,
        exclusions: [],
      },
      RCP: {
        keywords: [],
        match_threshold: 0,
        exclusions: [],
      },
    };
  }
}

function loadConfig() {
  try {
    const configData = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.warn(`Config file not found at ${CONFIG_PATH}, using defaults`);
    return {};
  }
}

function getProfiles() {
  if (!profiles) {
    profiles = loadProfiles();
  }
  return profiles;
}

function getConfig() {
  if (!config) {
    config = loadConfig();
  }
  return config;
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function checkProfileExclusion(text, profileName) {
  const profilesData = getProfiles();
  const profile = profilesData[profileName] || {};
  const exclusions = profile.exclusions || [];

  const lowerText = normalize(text);

  for (const exclusion of exclusions) {
    if (lowerText.includes(normalize(exclusion))) {
      return true;
    }
  }

  return false;
}


export function scoreOffer(offer, profile) {
  const searchText = normalize(`${offer.title || ''} ${offer.description || ''}`);
  const keywords = profile.keywords || [];

  let score = 0;
  const matchedTerms = [];

  for (const keyword of keywords) {
    const term = typeof keyword === 'string' ? keyword : keyword.term;
    const weight = typeof keyword === 'object' ? keyword.weight : 1;

    if (searchText.includes(normalize(term))) {
      score += weight;
      if (!matchedTerms.includes(term)) {
        matchedTerms.push(term);
      }
    }
  }

  return {
    score,
    matched_terms: matchedTerms,
  };
}

export function matchOffer(offer) {
  const profilesData = getProfiles();
  const ecbProfile = profilesData.ECB || { keywords: [], match_threshold: 0, exclusions: [] };
  const rcpProfile = profilesData.RCP || { keywords: [], match_threshold: 0, exclusions: [] };

  let scoreECB = 0;
  let scoreRCP = 0;
  let matchedTermsECB = [];
  let matchedTermsRCP = [];

  const searchText = `${offer.title} ${offer.description}`;

  const ecbExcluded = checkProfileExclusion(searchText, 'ECB');
  const rcpExcluded = checkProfileExclusion(searchText, 'RCP');

  if (!ecbExcluded) {
    const ecbResult = scoreOffer(offer, ecbProfile);
    scoreECB = ecbResult.score;
    matchedTermsECB = ecbResult.matched_terms;
  }

  if (!rcpExcluded) {
    const rcpResult = scoreOffer(offer, rcpProfile);
    scoreRCP = rcpResult.score;
    matchedTermsRCP = rcpResult.matched_terms;
  }

  const ecbThreshold = ecbProfile.match_threshold || 0;
  const rcpThreshold = rcpProfile.match_threshold || 0;

  const ecbPasses = !ecbExcluded && scoreECB >= ecbThreshold;
  const rcpPasses = !rcpExcluded && scoreRCP >= rcpThreshold;

  let matchedProfile = 'NONE';
  if (ecbPasses && rcpPasses) {
    matchedProfile = 'BOTH';
  } else if (ecbPasses) {
    matchedProfile = 'ECB';
  } else if (rcpPasses) {
    matchedProfile = 'RCP';
  }

  return {
    score_ECB: scoreECB,
    score_RCP: scoreRCP,
    matched_profile: matchedProfile,
    matched_terms_ECB: matchedTermsECB,
    matched_terms_RCP: matchedTermsRCP,
    is_relevant: matchedProfile !== 'NONE',
    excluded: ecbExcluded || rcpExcluded,
  };
}

export default {
  matchOffer,
  scoreOffer,
};
