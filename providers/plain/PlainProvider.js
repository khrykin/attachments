/**
 * PlainProvider is a provider for "plain" object
 * with save() and delete() methods
 * For example, can be used in browser
 */

const PlainProvider = {
  name: 'plain',
  addAttribute (object, attribute) {
    object[attribute] = {}
  },

  beforeSave (object, handle) {
    const _save = object.save
    object.save = async function () {
      await handle(this)
      _save.call(this)
    }
  },

  afterDelete (object, handle) {
    const _delete = object.save
    object.delete = async function () {
      await handle(this)
      _delete.call(this)
    }
  }
}

module.exports = PlainProvider
