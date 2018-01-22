/**
 * Generic Error
 */

class AttachmentsPluginError extends Error {
  constructor(message) {
    super()
    this.message = message ? message.message || message : ''
    this.name = 'AttachmentsPluginError'
  }
}

/**
 * Error for specific attribute validation
 */

class ValidationError extends AttachmentsPluginError {
  constructor(attribute, message) {
    super()
    this.message = message ? message.message || message : ''
    this.name = 'ValidationError'
    this.attribute = attribute
  }
}

/**
 * Abstract Error class
 */

class ModuleError extends AttachmentsPluginError {
  constructor(entity, message) {
    super()
    this.message = message ? message.message || message : ''
    this.name = this.constructor.name
    this[entity] = entity
  }
}

/**
 * Error that came from preprocessor methods
 */

class PreprocessorError extends ModuleError {}

/**
 * Error that came from storage methods
 */

class StorageError extends ModuleError {}

/**
 * Error that came from provider methods
 */

class ProviderError extends ModuleError {}

/* Messages */

const PROVIDER_NOT_SET_ERROR = "Provider isn't set"

const STORAGE_NOT_SET_ERROR = 'options.storage must be set'

const ATTRIBUTES_NOT_SET_ERROR = 'options.attributes must beset'

const PREPROCESSOR_NOT_SET_ERROR =
  'options.preprocessor must be set if attributes ' +
  'have pre-processing options'

const PROVIDER_METHOD_NOT_SET = method =>
  `Provider doesn't have ${method} method defined`

const PROVIDER_DIDNT_BIND_INSTANCE = (method, to) =>
  `Provider ${method} didn't bind instance to ${to}()`

const PREPROCESSOR_DID_NOT_RETURN = `Preprocessor process() didn't return anything`

const WRONG_ATTRIBUTE_ERROR = attr =>
  `Tried to attach attribute "${attr}", that isn't defined on the model`

module.exports = {
  AttachmentsPluginError,
  ValidationError,
  PreprocessorError,
  StorageError,
  ProviderError,

  PROVIDER_NOT_SET_ERROR,
  STORAGE_NOT_SET_ERROR,
  ATTRIBUTES_NOT_SET_ERROR,
  WRONG_ATTRIBUTE_ERROR,
  PREPROCESSOR_NOT_SET_ERROR,
  PROVIDER_METHOD_NOT_SET,
  PROVIDER_DIDNT_BIND_INSTANCE,
  PREPROCESSOR_DID_NOT_RETURN
}
