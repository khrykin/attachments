const im = require('imagemagick')
const kebabCase = require('lodash/kebabCase')
const path = require('path')
const fs = require('fs-extra')

const IMPreprocessor = {
  name: 'imagemagick',

  /**
   * Returns a promise with processed images's absolute paths by style
   * @param {string} filename
   * @param {Object} styles
   * @return {Promise<object, Error>}
   */

  async process(filename, styles = {}, data) {
    let result = {}

    if (
      !styles ||
      !Object.keys(styles).length ||
      (Object.keys(styles).length === 1 && styles.original)
    ) {
      throw new Error(NO_STYLES_ERROR)
    }

    let promises = []

    for (let style in styles) {
      // leave original file as it is
      if (style === 'original') {
        result.original = filename
        continue
      }

      const props = getPropsForData(styles[style], data)
      const args = getArgsFromProps(props)
      const format = getFormat(styles[style]['$format'])
      const processedFilename = getFilenameForStyle(filename, style, format)

      const promise = convert(
        filename,
        processedFilename,
        args
      ).then(processed => {
        result[style] = processed
      })

      promises.push(promise)
    }

    await Promise.all(promises)

    // If there is no original style defined,
    // remove original file

    if (!styles.original) {
      await fs.remove(filename)
    }

    return result
  }
}

/**
 * Converts Object with imagemagick props to array of args
 * sutable for convert CLI command
 * @param {Object} props
 * @param {Object} instance
 * @return {Array}
 */

function getArgsFromProps(props, instance) {
  if (typeof props !== 'object' || !Object.keys(props).length) {
    throw new Error(NO_PROPERTIES_ERROR)
  }

  let args = []
  for (let arg in props) {
    // dollar is reserved for file format
    if (/\$/.test(arg[0])) {
      continue
    }
    if (!/[-+]/.test(arg[0])) {
      args.push(`-${kebabCase(arg)}`)
    } else {
      args.push(arg)
    }
    args.push(`${props[arg]}`)
  }
  return args
}

/**
 * Passes data to lazily defined styles
 * @param {Object} props
 * @param {any} data
 * @return {Object}
 */

function getPropsForData(props, data) {
  return typeof props === 'function' ? props(data) : props
}

/**
 * Appends style to file basename like /some/dir/photo_thumb.jpg
 * @param {string} filename
 * @param {string} style
 * @return {string}
 */

function getFilenameForStyle(filename, style, format) {
  const { dir, ext, name } = path.parse(filename)
  return `${dir}/${name}_${style}${format || ext}`
}

/**
 *  Ensures dot before format
 * @param {?string} format
 * @return {string}
 */
function getFormat(format) {
  if (!format || /^\./.test(format)) return
  return `.${format}`
}

/**
 * Promise wrapper around imagemagick's convert
 * @param {string} source - source filename
 * @param {string} target - target filename
 * @param {string[]} args
 * @return {Promise<string, Error>}
 */

function convert(source, target, args = []) {
  if (!target) target = source
  return new Promise((resolve, reject) => {
    im.convert([source, ...args, target], (err, stdout, stderr) => {
      if (err) return reject(err)
      if (stderr) return reject(stderr)

      resolve(target)
    })
  })
}

/**
 * Returns imagemagick's -crop argument
 * @param {object} crop
 * @param {?number} crop.x - left corner x coordinate in px
 * @param {?number} crop.y - left corner y coordinate in px
 * @param {!number} crop.width - crop box width in px
 * @param {!number} crop.height - crop box height in px
 * @return {string}
 */

function getCrop(crop) {
  if (!crop) return undefined

  const { x = 0, y = 0, width, height } = crop

  if (typeof height === 'undefined') {
    throw new Error('crop width is undefined')
  }

  if (typeof height === 'undefined') {
    throw new Error('crop height is undefined')
  }

  return `${width}x${height}+${x}+${y}`
}

/* Errors */

const NO_STYLES_ERROR = 'No styles was set to process'
const NO_PROPERTIES_ERROR = "Can't have a style without any properties"

if (process.env.NODE_ENV === 'test') {
  Object.assign(IMPreprocessor, {
    getArgsFromProps,
    getFilenameForStyle,
    convert,
    NO_STYLES_ERROR,
    NO_PROPERTIES_ERROR
  })
}

Object.assign(IMPreprocessor, {
  getCrop
})

module.exports = IMPreprocessor
