const { Schema } = require('mongoose')

const MongooseProvider = {
  name: 'mongoose',
  addAttribute (schema, attribute, styles) {
    schema.add({ [attribute]: Schema.Types.Mixed })
  },

  beforeSave (schema, handle) {
    schema.pre('save', async function (next) {
      try {
        await handle(this, attr => this.isModified(attr))
      } catch (err) {
        // validation error
        if (err.errors) {
          // TODO convert AttachmentsPlugin ValidationError
          // to mongoose ValidationError
          return next(err)
        }
        // not-validation error
        console.error(err.stack)
      }
      return next()
    })
  },

  afterDelete (schema, handle) {
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
