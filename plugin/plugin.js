const {
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
} = require('./errors')

const defaultOptions = {
  afterDelete: true
}

class AttachmentsPlugin {
  /**
   * See createPlugin
   */

  constructor(
    provider,
    {
      storage,
      preprocessor,
      attributes,
      afterDelete = defaultOptions.afterDelete
    } = defaultOptions
  ) {
    if (!provider) {
      throw new AttachmentsPluginError(PROVIDER_NOT_SET_ERROR)
    }

    if (!storage) {
      throw new AttachmentsPluginError(STORAGE_NOT_SET_ERROR)
    }

    if (!attributes) {
      throw new AttachmentsPluginError(ATTRIBUTES_NOT_SET_ERROR)
    }

    Object.assign(this, {
      provider,
      storage,
      attributes,
      preprocessor,
      afterDelete
    })

    for (let attr in attributes) {
      if (this.hasStyles(attr) && (!preprocessor || !preprocessor.process)) {
        throw new AttachmentsPluginError(PREPROCESSOR_NOT_SET_ERROR)
      }
    }
  }

  /**
   * Returns a method that must be binded to instance
   * in the provider's addMethods method
   */

  createAttach() {
    const plugin = this
    return function(attr, file) {
      // this here must be an model's instance

      if (!this) {
        throw new ProviderError(
          plugin.provider,
          PROVIDER_DIDNT_BIND_INSTANCE('addMethods', 'attach')
        )
      }

      return plugin.attach(this, attr, file)
    }
  }

  /**
   * Attaches files to instance's attribute
   */

  async attach(instance, attr, file) {
    // remove old file
    if (file === null) {
      return this.detach(instance, attr)
    }

    if (typeof this.attributes[attr] === 'undefined') {
      throw new Error(WRONG_ATTRIBUTE_ERROR(attr))
    }

    let filename

    /**
     * Allows to redefine filename
     * in beforeValidate middleware
     */

    const setFile = newFile => {
      file = newFile
      filename = this.getFilename(newFile)
    }

    setFile(file)

    const validate = this.getValidateForAttribute(attr)
    let stored = {}

    if (validate) {
      await this.validate(attr, file, instance, setFile)
    }

    if (!this.hasStyles(attr)) {
      // stored is scalar
      stored = await this.store(filename, attr, instance)
    } else {
      // stored is object
      const processed = await this.process(attr, filename, instance)

      for (let style in processed) {
        const filename = processed[style]
        const path = await this.store(filename, attr, instance)
        stored[style] = path
      }
    }

    // If we've succesfully stored new files - remove old ones
    if (instance[attr]) {
      await this.detach(instance, attr)
    }

    // Finally attach new stored files
    instance[attr] = stored

    return instance
  }

  /**
   * Returns a method that must be binded to instance
   * in the provider's addMethods method
   */

  createDetach() {
    const plugin = this
    return function(attr) {
      // this here must be an model's instance

      if (!this) {
        throw new ProviderError(
          plugin.provider,
          PROVIDER_DIDNT_BIND_INSTANCE('addMethods', 'detach')
        )
      }

      return plugin.detach(this, attr)
    }
  }

  /**
   * Removes all stored files for specific attribute
   */

  async detach(instance, attr) {
    const storage = this.getStorageForAttribute(attr)

    try {
      if (this.hasStyles(attr)) {
        for (let style in instance[attr]) {
          const filename = instance[attr][style]
          await storage.remove(filename, attr, instance)
        }
      } else {
        await storage.remove(instance[attr], attr, instance)
      }
      instance[attr] = null
    } catch (err) {
      throw new StorageError(storage, err)
    }
  }

  /**
   * This method will be passed as second argument to
   * provider's afterDelete method, where it must be called
   * with instance as argument
   * @param {object} instance
   * @return {Promise<, Error>}
   */

  async handleAfterDelete(instance) {
    if (!instance) {
      throw new Error(
        PROVIDER_DIDNT_BIND_INSTANCE(this.provider, 'afterDelete')
      )
    }

    const { attributes } = this

    try {
      for (let attr in attributes) {
        await this.detach(instance, attr)
      }
    } catch (err) {
      throw err
    }
  }

  /**
   * Resolves if validation passed or rejects with ValidationError
   * @param {object} validator
   * @param {!function} validator.validate
   * @param {file} filename
   * @param {object} instvalidateance
   */

  validate(attr, file, instance, setFile) {
    const validator = this.getValidateForAttribute(attr)
    const preValidator = this.getBeforeValidateForAttribute(attr)
    return new Promise((resolve, reject) => {
      preValidator(file, instance, (err, newFile) => {
        if (err) {
          return reject(err)
        }

        if (newFile) {
          setFile(newFile)
          file = newFile
        }

        validator(file, instance, err => {
          if (err) {
            return reject(new ValidationError(attr, err))
          }

          resolve()
        })
      })
    })
  }

  /**
   * Resolves with stored filename or rejects with StorageError
   */

  async store(filename, attr, instance) {
    const storage = this.getStorageForAttribute(attr)
    try {
      return await storage.write(filename, attr, instance)
    } catch (err) {
      throw new StorageError(storage, err)
    }
  }

  /**
   * Resolves with processed filename
   * or rejects with PreprocessorError
   */

  async process(attr, filename, instance) {
    const preprocessor = this.getPreprocessorForAttribute(attr)
    const styles = this.getStylesForAttribute(attr, instance)
    try {
      const processed = await preprocessor.process(filename, styles, instance)

      if (!processed || !Object.keys(processed).length) {
        throw new Error(PREPROCESSOR_DID_NOT_RETURN)
      }

      return processed
    } catch (err) {
      throw new PreprocessorError(preprocessor, err)
    }
  }

  /**
   * Evaluates dynamic styles
   */

  getStylesForAttribute(attr, instance) {
    let styles = {}
    for (let key in this.attributes[attr]) {
      if (NON_STYLE_KEYS.indexOf(key) > -1) {
        continue
      }

      let style = this.attributes[attr][key]

      if (typeof style === 'undefined' || style === null) {
        continue
      }

      if (typeof style === 'function') {
        style = style(instance)
      }

      styles[key] = style
    }
    return styles
  }

  /**
   * Returns an array of style names (keys) for given attribute
   */

  getStylesKeysForAttribute(attr) {
    const keys = []
    for (let key in this.attributes[attr]) {
      if (NON_STYLE_KEYS.indexOf(key) < 0) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * Returns attribute-specific storage
   * or default if such not set
   * @param {string} attr
   * @return {Storage}
   */

  getStorageForAttribute(attr) {
    return this.attributes[attr].storage || this.storage
  }

  /**
   * Returns attribute-specific preprocessor
   * or default if such not set
   * @param {string} attr
   * @return {Preprocessor}
   */

  getPreprocessorForAttribute(attr) {
    return this.attributes[attr].preprocessor || this.preprocessor
  }

  /**
   * Returns attribute validator
   * @param {string} attr
   * @return {function} validate
   */

  getValidateForAttribute(attr) {
    const { validate } = this.attributes[attr]
    return typeof validate === 'function' && validate
  }

  /**
   * Returns attribute's beforeValidate()
   * @param {string} attr
   * @return {function} validate
   */

  getBeforeValidateForAttribute(attr) {
    const { beforeValidate } = this.attributes[attr]
    return typeof beforeValidate === 'function'
      ? beforeValidate
      : (file, instance, next) => {
          next()
        }
  }

  /**
   * Returns attribute non-style options
   * @param {string} attr
   * @return {Object} options
   * @return {function} options.storage
   * @return {function} options.preprocessor
   * @return {function} options.validate
   */

  getOptionsForAttribute(attr) {
    const storage = this.getStorageForAttribute(attr)
    const preprocessor = this.getPreprocessorForAttribute(attr)
    const validate = this.getValidateForAttribute(attr)
    return {
      storage,
      preprocessor,
      validate
    }
  }

  /**
   * Returns Filename for given file
   * @param {object|string} file
   * @param {string} file.path
   * @return {string} filename
   */

  getFilename(file) {
    return file.path || file
  }

  /**
   * Attaches attributes from options
   */

  attachAttributes(model) {
    if (!this.provider.addAttribute) {
      throw new ProviderError(
        this.provider,
        PROVIDER_METHOD_NOT_SET('addAttribute')
      )
    }

    for (let attr in this.attributes) {
      const keys = this.getStylesKeysForAttribute(attr)
      this.provider.addAttribute(model, attr, keys)
    }
  }

  /**
   * Checks if styles has preprocessing defined for given attribute
   * @param {string} attr
   * @return {boolean}
   */

  hasStyles(attr) {
    const onlyStylesKeys = this.getStylesKeysForAttribute(attr)
    return !!onlyStylesKeys.length
  }

  /**
   * Returns main plugin function
   */

  create() {
    return model => {
      this.attachAttributes(model)

      const { provider } = this

      if (!provider.addMethods) {
        throw new ProviderError(provider, PROVIDER_METHOD_NOT_SET('addMethods'))
      }

      provider.addMethods(model, this.createAttach(), this.createDetach())

      if (this.afterDelete) {
        if (!provider.addAfterDelete) {
          throw new ProviderError(
            provider,
            PROVIDER_METHOD_NOT_SET('addAfterDelete')
          )
        }

        provider.addAfterDelete(model, this.handleAfterDelete.bind(this))
      }

      return model
    }
  }
}

/**
 * This keys are reserved and can't be used as styles
 */

const NON_STYLE_KEYS = ['beforeValidate', 'validate', 'storage', 'preprocessor']

/**
 * Creates plugin function from AttachmentsPlugin's instance.
 * @param {Provider} provider
 * @param {Object} options
 * @param {Storage} options.storage
 * @param {Preprocessor} options.preprocessor
 * @param {Object} options.attributes
 */

function createPlugin(...args) {
  return new AttachmentsPlugin(...args).create()
}

if (process.env.NODE_ENV === 'test') {
  Object.assign(createPlugin, {
    AttachmentsPlugin
  })
}

module.exports = createPlugin
