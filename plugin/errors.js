class AttachmentsPluginError extends Error {
  constructor (message) {
    super()
    this.message = message`${this.constructor.name}: ${message}`
  }
}

/**
 * Erorr for specific attribute validation
 */

class ValidationError extends Error {
  constructor (attribute, message) {
    super(message)
    this.attribute = attribute
  }
}

/**
 * Abstract Error class
 */

class ModuleError extends Error {
  constructor (entity, message) {
    super()
    const text = message.message || message
    const name = entity.name ? capitalize(entity.name) : ''
    this.message = `${name}${this.constructor.name}: ${text}`
    this[entity] = entity
  }
}

/**
 * Erorr that came from preprocessor methods
 */

class PreprocessorError extends ModuleError {}

/**
 * Erorr that came from storage methods
 */

class StorageError extends ModuleError {}

/**
 * Erorr that came from provider methods
 */

class ProviderError extends ModuleError {}

/* Messages */

const PROVIDER_NOT_SET_ERROR =
  'Provider isn\'t set'

const STORAGE_NOT_SET_ERROR =
  'options.storage must be set'

const ATTRIBUTES_NOT_SET_ERROR =
  'options.attributes must beset'

const PREPROCESSOR_NOT_SET_ERROR =
  'options.preprocessor must be set if attributes ' +
  'have pre-processing options'

const PROVIDER_METHOD_NOT_SET = method =>
  `Provider doesn't have ${method} method defined`

const PROVIDER_DIDNT_BIND_INSTANCE = (method, to) =>
`Provider ${method} didn't bind instance to ${to}()`

const PREPROCESSOR_DID_NOT_RETURN =
  `Preprocessor process() didn't return anything`

/**
 * Capitalizes
 */

function capitalize (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

module.exports = {
  AttachmentsPluginError,
  ValidationError,
  PreprocessorError,
  StorageError,
  ProviderError,

  PROVIDER_NOT_SET_ERROR,
  STORAGE_NOT_SET_ERROR,
  ATTRIBUTES_NOT_SET_ERROR,
  PREPROCESSOR_NOT_SET_ERROR,
  PROVIDER_METHOD_NOT_SET,
  PROVIDER_DIDNT_BIND_INSTANCE,
  PREPROCESSOR_DID_NOT_RETURN
}
