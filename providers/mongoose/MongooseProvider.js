const { Schema } = require('mongoose')

const MongooseProvider = {
  name: 'mongoose',
  addAttribute (schema, attribute, styles) {
    schema.add({ [attribute]: Schema.Types.Mixed })
  },

  addMethods (schema, attach, detach) {
    schema.methods.attach = attach
    schema.methods.detach = detach
  },

  addAfterDelete (schema, handle) {
    schema.post('remove', async function (next) {
      try {
        await handle(this)
      } catch (err) {
        return console.error(err.stack)
      }
      return next()
    })
  }
}

module.exports = MongooseProvider
