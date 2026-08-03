/**
 *
 *    Copyright (c) 2024 Silicon Labs
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

/**
 * Load / mutate / save lifecycle for the `zap edit` command line. This is the
 * headless counterpart of what the HTTP server does for the GUI: it puts a
 * .zap file into a session in the database, hands that session to the
 * operations, and writes the result back out.
 *
 * @module CLI API: session lifecycle
 */

const fs = require('fs')
const path = require('path')

const dbApi = require('../db/db-api.js')
const dbEnum = require('../../src-shared/db-enum.js')
const env = require('../util/env.js')
const util = require('../util/util.js')
const zclLoader = require('../zcl/zcl-loader.js')
const generatorEngine = require('../generator/generation-engine.js')
const importJs = require('../importexport/import.js')
const exportJs = require('../importexport/export.js')
const querySession = require('../db/query-session.js')
const querySessionNotification = require('../db/query-session-notification.js')
const queryPackageNotification = require('../db/query-package-notification.js')
const validateAll = require('../validation/validate-all.js')
const cliError = require('./cli-error.js')

const CliError = cliError.CliError

/**
 * Opens a .zap file into a fresh session, or creates an empty configuration
 * when `zapFile` is null.
 *
 * @param {*} argv Parsed command line.
 * @param {*} options `logger` plus an optional `zapFile` override.
 * @returns {Promise<*>} the context handed to every operation
 */
async function open(argv, options = {}) {
  let logger = options.logger || (() => {})
  let zapFile = options.zapFile !== undefined ? options.zapFile : argv.zapFile

  if (zapFile != null && !fs.existsSync(zapFile)) {
    throw new CliError(`No such file: ${zapFile}`)
  }

  let db = await dbApi.initDatabaseAndLoadSchema(
    env.sqliteFile('edit'),
    env.schemaFile(),
    env.zapVersion()
  )
  logger(env.formatEmojiMessage('🐝', 'database and schema initialized'))

  await zclLoader.loadZclMetafiles(db, argv.zclProperties, {
    failOnLoadingError: !argv.noLoadingFailure
  })
  logger(
    env.formatEmojiMessage('🔧', `zcl package loaded: ${argv.zclProperties}`)
  )

  if (argv.generationTemplate != null) {
    let ctx = await generatorEngine.loadTemplates(db, argv.generationTemplate, {
      failOnLoadingError: !argv.noLoadingFailure
    })
    if (ctx.error && !argv.noLoadingFailure) {
      throw new Error(ctx.error)
    }
  }

  let sessionId
  if (zapFile == null) {
    sessionId = await querySession.createBlankSession(db)
    logger(env.formatEmojiMessage('🔧', 'starting from an empty configuration'))
  } else {
    let importResult
    try {
      importResult = await importJs.importDataFromFile(db, zapFile, {
        defaultZclMetafile: argv.zclProperties,
        defaultTemplateFile: argv.generationTemplate,
        packageMatch: argv.packageMatch,
        postImportScript: argv.postImportScript
      })
    } catch (err) {
      // The importer assumes it was handed something already known to be a
      // configuration, so anything else surfaces as a parse error or a stray
      // type error. Neither says what the caller got wrong.
      throw new CliError(`${zapFile} could not be read as a configuration`, [
        `  ${err.message || err}`,
        `Expected a .zap file, or an ISC file to convert from.`
      ])
    }
    sessionId = importResult.sessionId
    if (importResult.errors != null && importResult.errors.length > 0) {
      throw new CliError(
        `Failed to read ${zapFile}`,
        importResult.errors.map((e) => `  ${e}`)
      )
    }
    logger(env.formatEmojiMessage('👈', `read in: ${zapFile}`))
  }

  await util.ensurePackagesAndPopulateSessionOptions(db, sessionId, {
    zcl: argv.zclProperties,
    template: argv.generationTemplate
  })

  return {
    db: db,
    sessionId: sessionId,
    zapFile: zapFile,
    category: argv.category || null,
    logger: logger,
    argv: argv
  }
}

/**
 * Runs the same validation that `zap validate` and the GUI run.
 *
 * @param {*} ctx
 * @returns {Promise<*>} validation report
 */
async function validate(ctx) {
  return validateAll.validateAll(ctx.db, ctx.sessionId, {
    persistConformanceNotifications: false
  })
}

/**
 * Turns database notification rows into what the CLI reports.
 *
 * @param {string} scope
 * @param {Array} rows
 * @returns {Array} array of `{ scope, type, severity, message }`
 */
function describeNotifications(scope, rows) {
  return rows.map((row) => ({
    scope: scope,
    type: row.type,
    severity: row.severity,
    message: row.message
  }))
}

/**
 * Everything ZAP has to say about this configuration that it did not raise as
 * an error: the notifications behind the count the user interface shows in its
 * toolbar.
 *
 * They are written as the configuration is read in and as it is edited, partly
 * by the importer and partly by database triggers watching for things like a
 * provisional cluster being switched on, and they are the only record of some
 * of it.
 *
 * @param {*} ctx
 * @returns {Promise<Array>} array of `{ scope, type, severity, message }`
 */
async function notifications(ctx) {
  return describeNotifications(
    'configuration',
    await querySessionNotification.getNotification(ctx.db, ctx.sessionId)
  )
}

/**
 * What ZAP has to say about the data model rather than about any configuration
 * built on it, such as a cluster definition whose XML contradicts itself. These
 * outlive the session, which is why the user interface keeps them apart, on the
 * packages themselves.
 *
 * @param {*} ctx
 * @returns {Promise<Array>} array of `{ scope, type, severity, message }`
 */
async function packageNotifications(ctx) {
  return describeNotifications(
    'data model',
    await queryPackageNotification.getNotificationBySessionId(
      ctx.db,
      ctx.sessionId
    )
  )
}

/**
 * Writes the session back out to a .zap file.
 *
 * Two things are worth knowing about the export underneath. It always leaves a
 * `~` copy of whatever the file held before, so there is nothing to opt into.
 * And it takes the save file format from the environment rather than from its
 * options, which is why `--saveFileFormat` is applied while the arguments are
 * parsed and not passed along here.
 *
 * @param {*} ctx
 * @param {string} outputPath
 * @param {*} options
 * @returns {Promise<string>} the path that was written
 */
async function save(ctx, outputPath, options = {}) {
  let parent = path.dirname(outputPath)
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true })
  }
  await querySession.updateSessionKeyValue(
    ctx.db,
    ctx.sessionId,
    dbEnum.sessionKey.filePath,
    outputPath
  )
  return exportJs.exportDataIntoFile(ctx.db, ctx.sessionId, outputPath, {
    removeLog: options.noZapFileLog === true
  })
}

/**
 * Releases the database.
 *
 * @param {*} ctx
 * @returns {Promise} promise of a closed database
 */
async function close(ctx) {
  if (ctx != null && ctx.db != null) {
    return dbApi.closeDatabase(ctx.db)
  }
}

exports.open = open
exports.save = save
exports.close = close
exports.notifications = notifications
exports.packageNotifications = packageNotifications
exports.validate = validate
