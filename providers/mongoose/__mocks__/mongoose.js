/* eslint-env jest */

// mocking mongoose somehow fails with
// TypeError: Cannot create property 'constructor' on number '1'
// See https://github.com/facebook/jest/issues/3073

// const mongoose = jest.genMockFromModule('mongoose')
const mongoose = {}

class Schema {
  constructor (attributes) {
    this.attributes = {}
    this.middleware = { pre: {}, post: {} }
    this.add(attributes)
  }

  add (attributes) {
    Object.assign(this.attributes, attributes)
  }

  pre (name, middleware) {
    this.middleware.pre[name] = middleware
  }

  post (name, middleware) {
    this.middleware.post[name] = middleware
  }
}

Schema.Types = {
  Mixed: 'MIXED_TYPE'
}

const model = (name, schema) => class {
  constructor (attributes) {
    Object.assign(this, attributes)
  }

  async save () {
    schema.middleware.pre.save.call(this, () => {
      /* save */
    })
  }

  async remove () {
    /* remove */
    schema.middleware.post.remove.call(this, () => {

    })
  }
}

Object.assign(mongoose, {
  Schema,
  model
})

module.exports = mongoose
