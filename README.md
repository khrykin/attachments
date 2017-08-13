# Attachments
[![npm version](https://badge.fury.io/js/attachments.svg)](https://badge.fury.io/js/attachments) [![build statud](https://travis-ci.org/khrykin/attachments.svg)](https://travis-ci.org/khrykin/attachments.svg)


## Storage and model agnostic modular framework for hadling file attachments and preprocessing

This package provides easy interfaces to collocate your file storage and preprocessing rules next to your models for potentially any ORM/ODM (Mongoose, Sequelize, etc.), preprocessor (imagemagick, custom parsers, etc.) and storage options (local file system, S3,...) you can imagine.

### Status
It's in beta until `1.0.0`.

### How it works
To create a plugin, which you can wrap around your model, you must choose model `provider`, one (or several) `storage`s and `preprocessor`s and setup preprocessing rules (styles), which can be dynamic (i.e depend on file and instance) and also can be validated.

`provider`s, `storage`s and `preprocessor`s are meant to be small modules, which conforms to some simple protocols seen below:

### Providers

```javascript
// mongoose
const MongooseProvider = require('attachments-provider-mongoose')
const provider = MongooseProvider
```
```javascript
// TODO: Sequelize
const SequelizeProvider = require('attachments-provider-sequelize')
const provider = SequelizeProvider
```
```javascript
// Or implement your own for anything:

// Given some generic model
class User extends SomeODMModel {
  static schema = {
    name: String,
    email: String,
    password: String
  }
}

// Here is provider for our ODM
const AnythingProvider = {
  name: 'some-odm',
  addAttribute (model, attribute, styles) {
    // attach attribute to model

    model.schema[attribute] = Object

    // model here is some entity to which you can attach
    // attributes and lifecycle hooks - for example
    // 'schema' in mongoose or 'model' in sequelize
    // or User - in this case

    // Note that if you've setup preprocessing styles,
    // model's instance must be able to set processed filenames
    // by setting instance[attribute] as object,
    // so, in case if attribute can only be scalar (i.e String), you would also
    // want to setup corresponding scalar attribute
    // for each style and some 'virtual' getter.
    // For our example model this would look like this:
    //
    //   for (let style in styles) {
    //     this[`${attribute}_${style}`] = String
    //   }
    //   
    //   Object.assign(User.schema, {
    //     get [attribute]() {
    //       let all = {}
    //       for (let style in styles) {
    //         all[style] = this[`${attribute}_${style}`]
    //       }
    //       return all
    //     }
    //   })
  },

  addMethods (model, attach, detach) {
    // add attach() and detach() to your
    // model's instance methods.

    // For our example:

    model.prototype.attach = attach
    model.prototype.detach = detach
  },

  afterDelete (model, handle) {
    //setup after delete hook on model
    // where you must await for handle()

    // For our example, given that ODMModel has
    // ODMModel.after() method:

    model.after('destroy', async function (next) {
      try {
        // note that model's instance (this) bust be
        // passed to handle()

        await handle(this)
        return next()
      } catch (err) {
        //Show error if handle() rejects
        console.error(err.stack)
      }
    })
  }
}
const provider = AnythingProvider
```

### Preprocessors

```javascript
// imagemagick
const IMPreprocessor = require('attachments-preprocessor-im')
const preprocessor = IMPreprocessor
```
```javascript
// text, binary, anything - implement your own
const AnythingPreprocessor = {
  name: 'anything',
  // process must be either async or return a promise
  async process (filename, styles = {}, data) {
    // do some crazy shit
    return processed // path to processed entity
  }
}
const preprocessor = AnythingPreprocessor
```
### Storages
```javascript
//local file system
const LocalFsStorage = require('attachments-storage-local-fs')
const storage = new LocalFsStorage({
  pathToPublic: '/some/dir/public',
  publicBasepath: (attribute, instance) =>
    `/users/${instance._id}/${attribute}s`
  // or just static
  //, publicBasepath: '/users/uploads'
```
```javascript
//Anything remote
const RemoteStorage = {
  async write (file, attribute, instance) {
    // store somewhere
    return stored
  },

  async remove (remotePath, attribute, instance) {
    // remove from stored
  }
}
const storage = RemoteStorage
})
```

### Putting it all together

```javascript
const createPlugin = require('attachments')

const plugin = createPlugin(provider, {
  storage, // default storage
  preprocessor, // default preprocessor
  attributes: {
    picture: {
      original: true,
      small: (instance) => ({
        crop: instance.crop
      })
    },
    thumb: {
      original: true,
      small: {
        resize: '12x12'
      },
    },
    large: {
      storage: SomeRemoteDataStorage // override default storage
      preprocessor: SomeDataPreprocessor // overrride default preprocessor
    },
    validate: (file, instance, next) => {
      // actual check implementation would depend on
      // how you set your files in instance.attach(),
      // if file is an object with mimetype property,
      // could be something like this:

      if(!/^image/.test(file.mimetype)) {
        return next(new Error('Wrong file type'))
      }

      next()
    }
  }
})

// Then you finally aplly created plugin to your model:

// Mongoose
schema.plugin(plugin)

// Sequelize or anything generic
plugin(Model)

```

If your settings are the same throughout the progect, you can, of course, create some high-order function in order to reduce boilerplate:

```javascript
// data/attachments.js
const createPlugin = require('attachments')
const MongooseProvider = require('attachments-provider-mongoose')
const LocalFsStorage = require('attachments-storage-local-fs')
const IMPreprocessor = require('attachments-preprocessor-im')

module.exports = (publicBasepath, attributes) => createPlugin(
  MongooseProvider, {
    storage: new LocalFsStorage({
      pathToPublic: '/some/dir/uploads',
      publicBasepath
    }),
    preprocessor: IMPreprocessor,
    attributes
  })
```
```javascript
// data/models/User.js
const attachments = require('../attachments')

const User = mongoose.model('User', schema)

attachments({
  picture: {
    small: {
      resize: '16x16'
    }
  }
})(User)

module.exports = User
```
After this you are able to set files on your instances via `instance.attach(attribute, file)` or remove via `instance.detach(attribute)` or `instance.attach(attribute, null)`

```javascript
const file = {
  path: '/tmp/photo.jpg',
  mimetype: 'image/jpeg'
} || '/tmp/photo.jpg'

const post = new Post({
  title: 'The Importance of Being Attached',
})

try {
  await post.attach('picture', file)
} catch (err) {
  // handle error
}

post.save()
```

And that's it!

## Development
All packages are stored in single repo. Run all tests with `npm test` or some specific test like `npm test -- LocalFsStorage`
Package naming conventions:
- provider - `attachments-provider-<name>`
- storage - `attachments-storage-<name>`
- preprocessor - `attachments-preprocessor-<name>`

Code should be written in [standard](https://standardjs.com/) with node `>8.0.0` syntax and APIs

## License
ISC
