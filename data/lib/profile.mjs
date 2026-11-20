// The user's preferences from the first-run questions, kept in <home>/profile.json so they
// survive plugin updates. /mosaic asks once, writes the file with its file tools, and reads it
// at the start of every council. Everything here is tolerant: an unknown or missing value falls
// back to the default, and a broken file is reported so the questions can be asked again.
import fs from 'node:fs';
import path from 'node:path';

export const PROFILE_FILE = 'profile.json';
export const PROFILE_SCHEMA = 'mosaic.profile/1';

/** Allowed values for each field, and the default used when a field is missing or unknown. */
export const PROFILE_FIELDS = {
  experience: { values: ['new', 'some', 'pro'], default: 'some' },
  focus: { values: ['decision', 'stress_test', 'portfolio', 'macro'], default: [], list: true },
  horizon: { values: ['under-1y', '1-3y', '3-5y', '5y-plus', 'ask'], default: 'ask' },
  mode: { values: ['full', 'quick', 'ask'], default: 'full' },
  board: { values: ['ask', 'auto', 'default'], default: null },
};

/** A profile with every field set to an allowed value. Unknown keys are dropped. */
export function normalizeProfile(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { schema: PROFILE_SCHEMA };
  for (const [key, f] of Object.entries(PROFILE_FIELDS)) {
    const v = src[key];
    if (f.list) out[key] = Array.isArray(v) ? [...new Set(v.filter((x) => f.values.includes(x)))] : f.default;
    else out[key] = f.values.includes(v) ? v : f.default;
  }
  if (typeof src.created === 'string' && /^\d{4}-\d{2}-\d{2}/.test(src.created)) out.created = src.created.slice(0, 10);
  return out;
}

/**
 * Read <home>/profile.json.
 * @returns {{ state: 'missing' | 'ok' | 'broken', profile: object | null, file: string, error?: string }}
 */
export function readProfile(home) {
  const file = path.join(home, PROFILE_FILE);
  if (!fs.existsSync(file)) return { state: 'missing', profile: null, file };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not a JSON object');
    return { state: 'ok', profile: normalizeProfile(raw), file };
  } catch (e) {
    return { state: 'broken', profile: null, file, error: e.message };
  }
}

const EXPERIENCE = { new: 'new to investing', some: 'some experience', pro: 'experienced' };
const HORIZON = { 'under-1y': 'under a year', '1-3y': 'one to three years', '3-5y': 'three to five years', '5y-plus': 'five years or more', ask: 'asked each time' };
const MODE = { full: 'full councils', quick: 'quick councils', ask: 'asked each time' };

/** One plain line for the first-run check, e.g. "some experience, three to five years, full councils". */
export function profileSummary(p) {
  return [EXPERIENCE[p.experience], `horizon ${HORIZON[p.horizon]}`, MODE[p.mode]].join(', ');
}
