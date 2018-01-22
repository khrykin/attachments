const fs = require('fs-extra')
const path = require('path')

const defaultOptions = {
  cleanup: true
}

class LocalFsStorage {
  /**
   * @param {object} options
   * @param {!string|function<...data>} options.publicBasepath
   * - basepath relative to public folder
   * @param {!string} options.pathToPublic
   * - absolute path to public folder
   */

  constructor ({ publicBasepath, pathToPublic } = defaultOptions) {
    if (!publicBasepath) throw new Error(NO_PUBLIC_BASEPATH_ERROR)
    if (!pathToPublic) throw new Error(NO_PATH_TO_PUBLIC_ERROR)

    this.publicBasepath = publicBasepath
    this.pathToPublic = pathToPublic
  }

  getBasepath (...data) {
    const publicPath =
      typeof this.publicBasepath === 'function'
        ? this.publicBasepath(...data)
        : this.publicBasepath

    return path.join(this.pathToPublic, publicPath)
  }

  getPublicPath (absPath) {
    const reg = new RegExp(`^${this.pathToPublic}`)
    return path.normalize(absPath.replace(reg, '/'))
  }

  getAbsPath (publicPath) {
    return (...data) => {
      const basename = path.basename(publicPath)
      return path.join(this.getBasepath(...data), basename)
    }
  }

  /**
   * @param {string|object} file - local file to store
   * @param {any} ...data - will be passed as parameters to constructor's
   * options.publicBasepath if it's a function
   * @return {Promise<string, Error>} storedPath
   */

  async write (filename, ...data) {
    const basepath = this.getBasepath(...data)
    const basename = path.basename(filename)

    const absPath = path.join(basepath, basename)

    try {
      await fs.ensureDir(basepath)

      if (filename !== absPath) {
        // copy file to destination
        await fs.copy(filename, absPath)
        // remove file from tmp location
        await fs.remove(filename)
      }

      return this.getPublicPath(absPath)
    } catch (err) {
      throw err
    }
  }

  /**
   * @param {string|object} publicPath - publicPath to remove
   * @param {any} ...data - will be passed as parameters to constructor's
   * options.publicBasepath if it's a function
   * @return {Promise<, Error>}
   */

  async remove (publicPath, ...data) {
    try {
      let filename = this.getAbsPath(publicPath)(...data)
      let files = []
      do {
        await fs.remove(filename)
        filename = path.dirname(filename)
        files = await fs.readdir(filename)
      } while (!files.length && filename !== this.pathToPublic)
    } catch (err) {
      // don't throw if file was already removed
      if (err.code !== 'ENOENT') {
        throw err
      }
      console.warn(err)
    }
  }
}

const NO_PUBLIC_BASEPATH_ERROR =
  'options.publicBasepath must be provided for LocalFsStorage'

const NO_PATH_TO_PUBLIC_ERROR =
  'options.pathToPublic must be provided for LocalFsStorage'

if (process.env.NODE_ENV === 'test') {
  Object.assign(LocalFsStorage, {
    NO_PUBLIC_BASEPATH_ERROR,
    NO_PATH_TO_PUBLIC_ERROR
  })
}

module.exports = LocalFsStorage
