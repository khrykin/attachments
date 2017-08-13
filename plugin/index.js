const createPlugin = require('./plugin')
const errors = require('./errors')

module.exports = createPlugin

Object.assign(module.exports, errors)
