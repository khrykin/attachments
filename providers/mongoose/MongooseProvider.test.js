/* eslint-env jest */
// mocking mongoose somehow fails with
// TypeError: Cannot create property 'constructor' on number '1'
// See https://github.com/facebook/jest/issues/3073
// jest.mock('mongoose')

const { Schema, model } = require('./__mocks__/mongoose')

const {
  addAttribute,
  beforeSave,
  afterDelete
} = require('./MongooseProvider')

describe('MongooseProvider', () => {
  const schema = new Schema({ name: String })
  addAttribute(schema, 'picture')

  describe('addAttribute', () => {
    it('should add Schema.Types.Mixed attribute', () => {
      expect(schema.attributes.picture)
        .toEqual(Schema.Types.Mixed)
    })
  })

  describe('beforeSave', () => {
    beforeSave(schema, (instance) => {
      expect(instance._id).toBe(1)
    })

    afterDelete(schema, (instance) => {
      expect(instance._id).toBe(1)
    })

    const User = model('User', schema)
    const user = new User({ _id: 1 })

    it('should call handle(this) before save', async () => {
      expect.assertions(1)
      try {
        await user.save()
      } catch (err) {
        throw err
      }
    })

    it('should call handle(this) after delete', async () => {
      expect.assertions(1)
      try {
        await user.remove()
      } catch (err) {
        throw err
      }
    })
  })
})
