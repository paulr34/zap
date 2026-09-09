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
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.path === 'string' &&
        entry.path.length > 0 &&
        Number.isFinite(entry.lastOpened)
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
  storage.setItem(rendApi.storageKey.recentZapFiles, JSON.stringify(entries))
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
      name: entry.path.split(/[/\\]/).pop() || entry.path
    }))
}

/**
 * Records that a .zap file was opened or saved.
 *
 * @param {string} filePath
 */
export function recordRecentZapFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return
  if (!filePath.toLowerCase().includes('.zap')) return

  let normalized = filePath
  let now = Date.now()
  let existing = readAllRecentZapFiles().filter(
    (entry) => entry.path !== normalized
  )
  existing.unshift({ path: normalized, lastOpened: now })
  writeRecentZapFiles(existing.slice(0, MAX_RECENT_FILES))
}

/**
 * Removes a path from the recent list.
 *
 * @param {string} filePath
 */
export function removeRecentZapFile(filePath) {
  if (!filePath) return
  writeRecentZapFiles(
    readAllRecentZapFiles().filter((entry) => entry.path !== filePath)
  )
}
