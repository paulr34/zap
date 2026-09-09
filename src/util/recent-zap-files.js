/**
 *
 *    Copyright (c) 2026 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

import * as storage from './storage.js'
import rendApi from '../../src-shared/rend-api.js'

const MAX_RECENT_FILES = 50
export const RECENT_ZAP_FILES_CHANGED_EVENT = 'zap-recent-files-changed'

/**
 * True if path ends with a .zap extension.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isZapFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  return /\.zap$/i.test(filePath.trim())
}

/**
 * Normalize separators and trim for stable client-side comparison.
 * @param {string} filePath
 * @returns {string}
 */
export function normalizeZapPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return ''
  let normalized = filePath.trim().replace(/\\/g, '/')
  // Collapse duplicate separators but keep leading // for UNC if present.
  if (normalized.startsWith('//')) {
    normalized = '//' + normalized.slice(2).replace(/\/+/g, '/')
  } else {
    normalized = normalized.replace(/\/+/g, '/')
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

/**
 * Case-insensitive key for dedupe on typical desktop OSes.
 * @param {string} filePath
 * @returns {string}
 */
export function zapPathKey(filePath) {
  return normalizeZapPath(filePath).toLowerCase()
}

/**
 * @returns {number} configured lookback days (default 21)
 */
export function getRecentZapFilesLookbackDays() {
  let raw = storage.getItem(rendApi.storageKey.recentZapFilesLookbackDays)
  let days = parseInt(raw, 10)
  if (!Number.isFinite(days) || days < 1) {
    return rendApi.DEFAULT_RECENT_ZAP_FILES_LOOKBACK_DAYS
  }
  return days
}

/**
 * @param {number|string} days
 */
export function setRecentZapFilesLookbackDays(days) {
  let value = parseInt(days, 10)
  if (!Number.isFinite(value) || value < 1) {
    value = rendApi.DEFAULT_RECENT_ZAP_FILES_LOOKBACK_DAYS
  }
  storage.setItem(rendApi.storageKey.recentZapFilesLookbackDays, String(value))
  notifyRecentZapFilesChanged()
}

/**
 * @returns {Array<{path: string, lastOpened: number}>}
 */
function readAllRecentZapFiles() {
  let raw = storage.getItem(rendApi.storageKey.recentZapFiles)
  if (!raw) return []
  try {
    let parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return dedupeEntries(
      parsed.filter(
        (entry) =>
          entry &&
          typeof entry.path === 'string' &&
          isZapFilePath(entry.path) &&
          Number.isFinite(Number(entry.lastOpened))
      )
    )
  } catch (e) {
    return []
  }
}

/**
 * Persists the recent-file list to localStorage.
 *
 * @param {Array<{path: string, lastOpened: number}>} entries
 */
function writeRecentZapFiles(entries) {
  let pruned = dedupeEntries(entries)
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .slice(0, MAX_RECENT_FILES)
  storage.setItem(rendApi.storageKey.recentZapFiles, JSON.stringify(pruned))
}

/**
 * @param {Array<{path: string, lastOpened: number}>} entries
 * @returns {Array<{path: string, lastOpened: number}>}
 */
function dedupeEntries(entries) {
  let byKey = new Map()
  for (const entry of entries) {
    if (!entry || !isZapFilePath(entry.path)) continue
    let normalized = normalizeZapPath(entry.path)
    let key = zapPathKey(normalized)
    let lastOpened = Number(entry.lastOpened)
    if (!Number.isFinite(lastOpened)) lastOpened = 0
    let existing = byKey.get(key)
    if (!existing || lastOpened >= existing.lastOpened) {
      byKey.set(key, { path: normalized, lastOpened })
    }
  }
  return Array.from(byKey.values())
}

/**
 * Notify same-window listeners that recent files / lookback changed.
 */
function notifyRecentZapFilesChanged() {
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent(RECENT_ZAP_FILES_CHANGED_EVENT))
  }
}

/**
 * Returns recent .zap files within the configured lookback window,
 * newest first.
 *
 * @returns {Array<{path: string, lastOpened: number, name: string}>}
 */
export function getRecentZapFiles() {
  let lookbackMs = getRecentZapFilesLookbackDays() * 24 * 60 * 60 * 1000
  let cutoff = Date.now() - lookbackMs
  return readAllRecentZapFiles()
    .filter((entry) => entry.lastOpened >= cutoff)
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .map((entry) => ({
      ...entry,
      name: entry.path.split('/').pop() || entry.path
    }))
}

/**
 * Records that a .zap file was opened or saved.
 *
 * @param {string} filePath
 */
export function recordRecentZapFile(filePath) {
  if (!isZapFilePath(filePath)) return
  let normalized = normalizeZapPath(filePath)
  let now = Date.now()
  let existing = readAllRecentZapFiles().filter(
    (entry) => zapPathKey(entry.path) !== zapPathKey(normalized)
  )
  existing.unshift({ path: normalized, lastOpened: now })
  writeRecentZapFiles(existing)
  // Also keep last-file location in sync when possible.
  storage.setItem(rendApi.storageKey.fileSave, normalized)
  notifyRecentZapFilesChanged()
}

/**
 * Merge server/DB recent files into localStorage (cold-start seed).
 * Does not overwrite a newer local timestamp for the same path.
 * Unknown server paths are brought into the current lookback window so the
 * list is not empty on first launch after upgrade.
 *
 * @param {Array<{path: string, lastOpened: number}>} serverEntries
 */
export function mergeRecentZapFilesFromServer(serverEntries) {
  let lookbackMs = getRecentZapFilesLookbackDays() * 24 * 60 * 60 * 1000
  let cutoff = Date.now() - lookbackMs
  let merged = readAllRecentZapFiles()
  let known = new Set(merged.map((e) => zapPathKey(e.path)))

  if (Array.isArray(serverEntries)) {
    for (const entry of serverEntries) {
      if (!entry || !isZapFilePath(entry.path)) continue
      let normalized = normalizeZapPath(entry.path)
      let key = zapPathKey(normalized)
      let lastOpened = Number(entry.lastOpened)
      if (!Number.isFinite(lastOpened)) lastOpened = Date.now()
      // First time we learn about this path from the DB: ensure it is visible.
      if (!known.has(key) && lastOpened < cutoff) {
        lastOpened = Date.now()
      }
      merged.push({ path: normalized, lastOpened })
      known.add(key)
    }
  }

  seedFromLastFileLocationInto(merged)
  writeRecentZapFiles(merged)
  notifyRecentZapFilesChanged()
  return getRecentZapFiles()
}

/**
 * @param {Array<{path: string, lastOpened: number}>} merged
 */
function seedFromLastFileLocationInto(merged) {
  let last = storage.getItem(rendApi.storageKey.fileSave)
  if (isZapFilePath(last)) {
    merged.push({
      path: normalizeZapPath(last),
      lastOpened: Date.now()
    })
  }
}

/**
 * Keep only paths the server reported as still existing.
 *
 * @param {Array<{path: string, lastOpened: number}>} existingEntries
 */
export function retainExistingRecentZapFiles(existingEntries) {
  let allowed = new Set(
    (existingEntries || []).map((e) => zapPathKey(e.path || e))
  )
  let retained = readAllRecentZapFiles().filter((entry) =>
    allowed.has(zapPathKey(entry.path))
  )
  // Prefer server-normalized paths / timestamps when provided.
  for (const entry of existingEntries || []) {
    if (!entry || !entry.path) continue
    retained.push({
      path: normalizeZapPath(entry.path),
      lastOpened: Number.isFinite(Number(entry.lastOpened))
        ? Number(entry.lastOpened)
        : Date.now()
    })
  }
  writeRecentZapFiles(retained)
  notifyRecentZapFilesChanged()
  return getRecentZapFiles()
}

/**
 * Removes a path from the recent list.
 *
 * @param {string} filePath
 */
export function removeRecentZapFile(filePath) {
  if (!filePath) return
  let key = zapPathKey(filePath)
  writeRecentZapFiles(
    readAllRecentZapFiles().filter((entry) => zapPathKey(entry.path) !== key)
  )
  notifyRecentZapFilesChanged()
}
