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
// Or implement your own for anything
const AnythingProvider = {
  name: 'super-duper-odm',
  addAttribute (model, attribute, styles) {
    // attach attribute to model

    // model here is some entity to which you can attach
    // attributes and lifecycle hooks - for example
    // 'schema' in mongoose or 'model' in sequelize.

    // Note that model must be able to get processed filenames
    // by setting instance[attribute] as object,
    // so, in case if attribute is scalar, you would also
    // want to setup corresponding scalar attribute for each style,
    // something like [attribute]_[style],
    // and virtual getter / setter
  },

  beforeSave (model, handle) {
    // setup before save hook on model

    // here you must call actual provider's hook setter
    // and call handle() inside
    model.before('save', async function (next) {
      try {
        // note that you must pass to handle() an instance object
        // (typically - this) and a function which tells
        // whether given attribute has been changed and needs to be updated
        // (like document.isModified() in mongooose)

        // handle() returns a promise, so you would also want to
        // catch error if handle() breaks and show it with console.error,
        // otherwise you will lose it
        await handle(this, (attr) => this.changed(attr))
        return next()
      } catch (err) {
        // validation error
        if (err.errors) {
          return next(new ValidationError(err))
        }
        // non-validation error
        console.error(err.stack)
      }
    })
  },

  afterDelete (model, handle) {
    //setup after delete hook on model
    model.after('destroy', async function (next) {
      try {
        // here handle() accepts only instance
        await handle(this)
        return next()
      } catch (err) {
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
  async write (file, ...data) {
    // store somewhere
    return stored
  },

  async remove (remotePath, ...data) {
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
      // actual check implementation would depend on storage
      // and how you set your files,
      // if file is an object with type property,
      // could be something like this:
      if(!/^image/.test(file.type)) {
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

const User = /* some model */

attachments({
  picture: {
    small: {
      resize: '16x16'
    }
  }
})(User)

module.exports = User
```
After this you are able to set files on your instances just as ordinary attributes:


```javascript

const post = new Post({
  title: 'The Importance of Being Attached',
  image: '/tmp/photo.jpg'
})

// or

const file = { path: '/tmp/photo.jpg' }
const post = new Post({
  title: 'The Importance of Being Attached',
  image: file
})

// or remove previously stored file(s)

post.image = null

post.save()
```

## Development
By now all packages are stored in single repo, but you must run tests from specific package directory.
Package naming conventions:
- provider - `attachments-provider-<name>`
- storage - `attachments-storage-<name>`
- preprocessor - `attachments-preprocessor-<name>`

Code should be written in [standard](https://standardjs.com/) with node `>8.0.0` syntax and APIs

## License
  MIT
