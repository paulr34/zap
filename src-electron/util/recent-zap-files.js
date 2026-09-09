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

const fs = require('fs')
const path = require('path')

/**
 * True if the path looks like a .zap file (extension only).
 * @param {string} filePath
 * @returns {boolean}
 */
function isZapFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  return path.extname(filePath).toLowerCase() === '.zap'
}

/**
 * Normalize a .zap path for stable comparison / storage.
 * @param {string} filePath
 * @returns {string}
 */
function normalizeZapPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return ''
  try {
    return path.normalize(filePath.trim())
  } catch (e) {
    return filePath.trim().replace(/\\/g, '/')
  }
}

/**
 * Deduping key that is case-insensitive on win32/darwin.
 * @param {string} filePath
 * @returns {string}
 */
function zapPathKey(filePath) {
  let normalized = normalizeZapPath(filePath)
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return normalized.toLowerCase()
  }
  return normalized
}

/**
 * Returns true if path exists and is a regular file.
 * @param {string} filePath
 * @returns {boolean}
 */
function zapFileExists(filePath) {
  if (!isZapFilePath(filePath)) return false
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch (e) {
    return false
  }
}

/**
 * Filter/dedupe recent file entries to existing .zap files.
 * @param {Array<{path: string, lastOpened: number}>} entries
 * @returns {Array<{path: string, lastOpened: number}>}
 */
function filterExistingRecentZapFiles(entries) {
  if (!Array.isArray(entries)) return []
  let byKey = new Map()
  for (const entry of entries) {
    if (!entry || !entry.path) continue
    let normalized = normalizeZapPath(entry.path)
    if (!zapFileExists(normalized)) continue
    let key = zapPathKey(normalized)
    let lastOpened = Number(entry.lastOpened)
    if (!Number.isFinite(lastOpened)) lastOpened = 0
    let existing = byKey.get(key)
    if (!existing || lastOpened >= existing.lastOpened) {
      byKey.set(key, { path: normalized, lastOpened })
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.lastOpened - a.lastOpened)
}

exports.isZapFilePath = isZapFilePath
exports.normalizeZapPath = normalizeZapPath
exports.zapPathKey = zapPathKey
exports.zapFileExists = zapFileExists
exports.filterExistingRecentZapFiles = filterExistingRecentZapFiles
