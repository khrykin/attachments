const defaultOptions = {
  afterDelete: true
}

class AttachmentsPlugin {
  constructor (provider, {
    storage,
    preprocessor,
    attributes,
    afterDelete
  } = defaultOptions) {
    if (!provider) throw new Error(PROVIDER_NOT_SET)
    if (!storage) throw new Error(STORAGE_NOT_SET_ERROR)
    if (!attributes) throw new Error(ATTRIBUTES_NOT_SET_ERROR)

    Object.assign(this, {
      provider,
      storage,
      attributes,
      preprocessor,
      afterDelete
    })

    for (let attr in attributes) {
      if (
        this.hasStyles(attr) &&
        (!preprocessor || !preprocessor.process)
      ) {
        throw new Error(PREPROCESSOR_NOT_SET_ERROR)
      }
    }
  }

  /**
   * This method will be passed as second argument to
   * provider's beforeSave method, where it must be called
   * with instance as argument
   * @param {object} instance
   * @return {Promise<, Error>}
   */

  async handleBeforeSave (instance, attrIsModified) {
    if (!instance) {
      throw new Error(
        PROVIDER_DIDNT_PASS_INSTANCE(
          this.provider,
          'beforeSave'
        )
      )
    }

    if (!attrIsModified) {
      throw new Error(
        PROVIDER_DIDNT_PASS_IS_MODIFIED(this.provider)
      )
    }

    // we'll store validation errors here
    let errors = {}

    for (let attr in this.attributes) {
      if (!attrIsModified(attr)) continue

      const file = instance[attr]

      if (file === null) {
        return this.removeForAttr(instance, attr)
      }

      let styles = this.attributes[attr]

      // override default storage/preprocessor for specific attribute
      const storage = styles.storage || this.storage
      const preprocessor = styles.preprocessor || this.preprocessor

      // we dont't want to pass this properties to preprocessor
      delete styles.storage
      delete styles.preprocessor

      // evaluate dynamic styles by passing instance
      styles = this.getStylesForAttribute(attr)(instance)

      let stored = {}

      if (this.hasStyles(attr)) {
        if (typeof styles.validate === 'function') {
          // custom validator error
          try {
            await this.validate(styles, file, instance)
          } catch (err) {
            errors = addAttributeError(
              errors,
              new AttributeError(attr, err)
            )
            continue // there were validation error, skip
          }
        }

        // we don't want have this property passed down to preprocessor
        delete styles.validate
        const processed = await preprocessor.process(file, styles, instance)
        // console.log('processed', processed)

        if (!processed) {
          throw new Error(
            PREPROCESSOR_DID_NOT_RETURN(preprocessor)
          )
        }
        try {
          for (let style in processed) {
            const file = processed[style]
            const path = await storage.write(file, attr, instance)
            stored[style] = path
          }
        } catch (err) {
          throw err
        }
      } else {
        try {
          // console.log('file in write', file)
          stored = await storage.write(file, attr, instance)
        } catch (err) {
          throw err
        }
      }

      instance[attr] = stored
    }

    if (Object.keys(errors).length) {
      // errors are grouped by attributes
      throw new ValidationError(errors)
    }
  }

  /**
   * This method will be passed as second argument to
   * provider's afterDelete method, where it must be called
   * with instance as argument
   * @param {object} instance
   * @return {Promise<, Error>}
   */

  async handleAfterDelete (instance) {
    if (!instance) {
      throw new Error(
        PROVIDER_DIDNT_PASS_INSTANCE(
          this.provider,
          'afterDelete'
        )
      )
    }

    const { attributes } = this

    try {
      for (let attr in attributes) {
        await this.removeForAttr(instance, attr)
      }
    } catch (err) {
      throw err
    }
  }

  /**
   * Removes all stored files for specific attribute
   */

  async removeForAttr (instance, attr) {
    const { storage } = this
    try {
      if (this.hasStyles(attr)) {
        for (let style in instance[attr]) {
          const file = instance[attr][style]
          await storage.remove(file, attr, instance)
        }
      } else {
        await storage.remove(instance[attr], attr, instance)
      }
    } catch (err) {
      throw err
    }
  }

  /**
   * Calls attribute's validator
   * @param {object} validator
   * @param {!function} validator.validate
   * @param {file} filename
   * @param {object} instvalidateance
   */

  validate (validator, filename, instance) {
    return new Promise((resolve, reject) => {
      validator.validate(filename, instance, (err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  /**
   * HOF. Returns a function that evaluates dynamic styles
   */

  getStylesForAttribute (attr) {
    return (instance) => {
      let styles = {}
      for (let key in this.attributes[attr]) {
        let style = this.attributes[attr][key]
        if (
          typeof style === 'function' &&
          key !== 'validate'
        ) {
          style = style(instance)
        }
        styles[key] = style
      }
      return styles
    }
  }

  /**
   * Returns an array of style names (keys) for given attribute
   */

  getStylesKeysForAttribute (attr) {
    let onlyStyles = Object.assign({}, this.attributes[attr])

    delete onlyStyles.storage
    delete onlyStyles.preprocessor
    delete onlyStyles.validate

    return Object.keys(onlyStyles)
  }

  /**
   * Attaches attributes from options
   */

  attachAttributes (model) {
    if (!this.provider.addAttribute) {
      throw new Error(PROVIDER_ADD_ATTRIBUTE_NOT_SET(this.provider))
    }

    for (let attr in this.attributes) {
      const keys = this.getStylesKeysForAttribute(attr)
      this.provider.addAttribute(model, attr, keys)
    }
  }

  /**
   * Main plugin function
   * @param {object} model - something that will be passed to
   * provider's methods (i.e mongoose's schema)
   * @return {object} model
   */

  attach (model) {
    this.attachAttributes(model)

    const { beforeSave, afterDelete } = this.provider

    if (!beforeSave) {
      throw new Error(PROVIDER_BEFORE_SAVE_NOT_SET(this.provider))
    }

    beforeSave(model, this.handleBeforeSave.bind(this))

    if (this.afterDelete) {
      if (!afterDelete) {
        throw new Error(PROVIDER_AFTER_DELETE_NOT_SET(this.provider))
      }

      afterDelete(model, this.handleAfterDelete.bind(this))
    }

    return model
  }

  /**
   * Checks if styles has preprocessing defined for given attribute
   * @param {string} attr
   * @return {boolean}
   */

  hasStyles (attr) {
    const onlyStylesKeys = this.getStylesKeysForAttribute(attr)
    return !!onlyStylesKeys.length
  }

  /**
   * Returns plugin function itself
   */

  create () {
    return this.attach.bind(this)
  }
}

/**
 * Returns new errors object with error appended to corresponding
 * attribute
 * @param {object} errors
 * @param {AttributeError} error
 * @return {object} errors
 */

function addAttributeError (errors, error) {
  return Object.assign({}, errors, {
    [error.attribute]: [
      ...errors[error.attribute],
      error
    ]
  })
}

/**
 * Creates plugin function from AttachmentsPlugin's instance.
 * Arguments are the same as in AttachmentsPlugin's constructor
 */

function createPlugin (...args) {
  const pluginInstance = new AttachmentsPlugin(...args)
  return pluginInstance.create()
}

/* Errors */

/**
 * Erorr for specific attribute validation
 */

class AttributeError extends Error {
  constructor (attribute, message) {
    super(message)
    if (typeof message === 'string') {
      this.message = message
    }
    this.attribute = attribute
  }
}

/**
 *  Collects errors for each attribute
 */

class ValidationError extends Error {
  constructor (errors) {
    super('AttachmentsPlugin ValidationError')
    this.errors = errors
  }
}

const PROVIDER_NOT_SET = 'Provider isn\'t set'

const STORAGE_NOT_SET_ERROR = 'options.storage must be set'

const ATTRIBUTES_NOT_SET_ERROR = 'options.attributes must beset'

const PREPROCESSOR_NOT_SET_ERROR =
  'options.preprocessor must be set if attributes ' +
  'have pre-processing options'

const PROVIDER_ADD_ATTRIBUTE_NOT_SET = ({ name = 'Unknown' }) =>
  `Provider ${name} doesn't have addAttribute method`

const PROVIDER_BEFORE_SAVE_NOT_SET = ({ name = 'Unknown' }) =>
  `Provider ${name} doesn't have beforeSave method`

const PROVIDER_AFTER_DELETE_NOT_SET = ({ name = 'Unknown' }) =>
  `Provider ${name} doesn't have afterDelete method`

const PROVIDER_DIDNT_PASS_INSTANCE = ({ name = 'Unknown' }, method) =>
  `Provider ${name}'s method ${method} didn't pass instance to handle()`

const PROVIDER_DIDNT_PASS_IS_MODIFIED = ({ name = 'Unknown' }) =>
  `Provider ${name}'s method beforeSave didn't pass isModified as
  second argumnet to handle()`

const PREPROCESSOR_DID_NOT_RETURN = ({ name = 'Unknown' }) => {
  `Preprocessor ${name} process() didn't return anything`
}

if (process.env.NODE_ENV === 'test') {
  Object.assign(createPlugin, {
    AttachmentsPlugin,
    PROVIDER_NOT_SET,
    STORAGE_NOT_SET_ERROR,
    ATTRIBUTES_NOT_SET_ERROR,
    PREPROCESSOR_NOT_SET_ERROR,
    PROVIDER_ADD_ATTRIBUTE_NOT_SET,
    PROVIDER_BEFORE_SAVE_NOT_SET,
    PROVIDER_AFTER_DELETE_NOT_SET,
    PROVIDER_DIDNT_PASS_INSTANCE,
    PROVIDER_DIDNT_PASS_IS_MODIFIED
  })
}

module.exports = createPlugin
