/* eslint-env jest */
// mocking mongoose somehow fails with
// TypeError: Cannot create property 'constructor' on number '1'
// See https://github.com/facebook/jest/issues/3073
// jest.mock('mongoose')

const { Schema, model } = require('./__mocks__/mongoose')

const {
  addAttribute,
  addMethods,
  addAfterDelete
} = require('./MongooseProvider')

const schema = new Schema({ name: String })

describe('MongooseProvider', () => {
  addAttribute(schema, 'picture')

  describe('addAttribute', () => {
    it('should add Schema.Types.Mixed attribute', () => {
      expect(schema.attributes.picture)
        .toEqual(Schema.Types.Mixed)
    })
  })

  describe('addMethods', () => {
    const attach = function () {
      expect(this._id).toBe(1)
    }
    const detach = attach

    addMethods(schema, attach, detach)

    const User = model('User', schema)
    const user = new User({ _id: 1 })

    it('should bind attach() and detach()', async () => {
      expect.assertions(2)
      try {
        await user.attach('picture', 'test.jpg')
        await user.detach('picture', 'test.jpg')
      } catch (err) {
        throw err
      }
    })
  })

  describe('addAfterDelete', () => {
    it('should pass this to handle()', async () => {
      expect.assertions(1)

      const handle = (instance) => {
        expect(instance._id).toBe(1)
      }

      addAfterDelete(schema, handle)

      const User = model('User', schema)
      const user = new User({ _id: 1 })

      user.picture = 'test.jpg'

      try {
        await user.remove()
      } catch (err) {
        throw err
      }
    })
  })
})
