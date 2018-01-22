/* eslint-env jest */

const createPlugin = require('./plugin')

const {
  AttachmentsPlugin
} = createPlugin

const {
  // AttachmentsPluginError,
  ValidationError,
  PreprocessorError,
  StorageError,
  // ProviderError,

  PROVIDER_NOT_SET_ERROR,
  STORAGE_NOT_SET_ERROR,
  ATTRIBUTES_NOT_SET_ERROR,
  PREPROCESSOR_NOT_SET_ERROR,
  // PROVIDER_METHOD_NOT_SET,
  PROVIDER_DIDNT_BIND_INSTANCE// ,
  // PREPROCESSOR_DID_NOT_RETURN
} = require('./errors')

class TestModel {
  constructor (props) {
    Object.assign(this, props)
  }
}

TestModel.schema = {
  id: Number,
  name: String
}

const testInstanceProps = {
  id: 1,
  name: 'Test User',
  crop: 100
}

const testStorage = {
  write: jest.fn((filename) => `/stored${filename}`),
  remove: jest.fn()
}

const TestProvider = {
  name: 'test',
  addAttribute: jest.fn(),
  addMethods: (model, attach, detach) => {
    model.prototype.attach = attach
    model.prototype.detach = detach
  },
  afterDelete: jest.fn()
}

const TestPreprocessor = {
  process: jest.fn((file, styles) => {
    let processed = {}
    for (let style in styles) {
      let suffix = `_${style}`
      if (style === 'original') {
        suffix = ''
      }
      processed[style] = `${file}${suffix}`
    }
    return processed
  })
}

const defaultOptions = {
  storage: testStorage,
  preprocessor: TestPreprocessor,
  attributes: {
    picture: {
      original: true,
      small: (instance) => ({
        resize: '16x16',
        crop: instance.crop
      }),
      validate: jest.fn((filename, instance, next) => {
        if (filename === 'wrong') {
          return next(new Error('Wrong file'))
        }

        if (instance.isWrong) {
          return next(new Error('Wrong instance'))
        }
        next()
      })
    },
    bg: {
      original: true
    },
    scalar: true
  }
}

const plugin = createPlugin(TestProvider, defaultOptions)

plugin(TestModel)

describe('AttachmentsPlugin', () => {
  describe('constructor', () => {
    it('should validate provider and options', () => {
       /* eslint-disable  no-new */
      expect(() => {
        new AttachmentsPlugin()
      }).toThrow(PROVIDER_NOT_SET_ERROR)

      expect(() => {
        new AttachmentsPlugin(TestProvider)
      }).toThrow(STORAGE_NOT_SET_ERROR)

      expect(() => {
        new AttachmentsPlugin(TestProvider, {
          storage: testStorage
        })
      }).toThrow(ATTRIBUTES_NOT_SET_ERROR)

      expect(() => {
        //eslint-disable-next-line
        new AttachmentsPlugin(TestProvider, {
          storage: testStorage,
          attributes: {
            picture: {
              small: {
                resize: '16x16'
              }
            }
          }
        })
      }).toThrow(PREPROCESSOR_NOT_SET_ERROR)
    })

    expect(() => {
      //eslint-disable-next-line
      new AttachmentsPlugin(TestProvider, {
        storage: testStorage,
        preprocessor: TestPreprocessor,
        attributes: {
          picture: {
            small: {
              resize: '16x16'
            }
          }
        }
      })
    }).not.toThrow()
  })

  describe('attachAttributes', () => {
    it('should pass model and style names to provider\'s addAttribute()', () => {
      expect(TestProvider.addAttribute)
        .toHaveBeenCalledWith(
          TestModel,
          'picture', ['original', 'small']
        )
      expect(TestProvider.addAttribute)
        .toHaveBeenCalledWith(
          TestModel,
          'bg', ['original']
        )
      expect(TestProvider.addAttribute)
        .toHaveBeenCalledWith(
          TestModel,
          'scalar', []
        )
    })
  })

  describe('attach', () => {
    let instance

    beforeEach(() => {
      instance = new TestModel(testInstanceProps)
      TestPreprocessor.process.mockClear()
      testStorage.write.mockClear()
      testStorage.remove.mockClear()
    })

    it('should store && attach files for attribute with styles', async () => {
      expect.assertions(2)
      try {
        await instance.attach('picture', '/some/dir/test')
        expect(instance.picture).toEqual({
          original: '/stored/some/dir/test',
          small: '/stored/some/dir/test_small'
        })

        expect(testStorage.write).toHaveBeenCalledTimes(2)
      } catch (err) {
        throw err
      }
    })

    it('should store && attach file for scalar attribute', async () => {
      expect.assertions(2)
      try {
        await instance.attach('scalar', '/some/dir/test')
        expect(instance.scalar).toEqual('/stored/some/dir/test')

        expect(testStorage.write).toHaveBeenCalledTimes(1)
      } catch (err) {
        throw err
      }
    })

    it('should store && attach files when file is object', async () => {
      expect.assertions(2)
      try {
        await instance.attach('picture', { path: '/some/dir/test' })
        expect(instance.picture).toEqual({
          original: '/stored/some/dir/test',
          small: '/stored/some/dir/test_small'
        })

        expect(testStorage.write).toHaveBeenCalledTimes(2)
      } catch (err) {
        throw err
      }
    })

    it('should remove previously stored files', async () => {
      expect.assertions(2)
      try {
        await instance.attach('picture', '/some/dir/test')
        await instance.attach('picture', '/some/dir/test2')

        expect(instance.picture).toEqual({
          original: '/stored/some/dir/test2',
          small: '/stored/some/dir/test2_small'
        })

        expect(testStorage.remove).toHaveBeenCalledTimes(2)
      } catch (err) {
        throw err
      }
    })

    it('should call beforeValidate')

    it('should validate', async () => {
      expect.assertions(4)
      try {
        await instance.attach('picture', 'wrong')
      } catch (err) {
        expect(err).toEqual(new ValidationError('picture', 'Wrong file'))
      }

      instance.isWrong = true
      try {
        await instance.attach('picture', '/some/dir/test2')
      } catch (err) {
        expect(err).toEqual(new ValidationError('picture', 'Wrong instance'))
      }

      expect(TestPreprocessor.process).not.toHaveBeenCalled()
      expect(testStorage.write).not.toHaveBeenCalled()
    })

    it('should catch storage or preprocessor errors', async () => {
      expect.assertions(3)
      testStorage.write.mockImplementationOnce(() => {
        throw new Error('storage write error')
      })

      try {
        await instance.attach('picture', '/some/dir/test')
      } catch (err) {
        expect(err).toEqual(
          new StorageError(testStorage, 'storage write error')
        )
      }

      testStorage.remove.mockImplementationOnce(() => {
        throw new Error('storage remove error')
      })

      try {
        await instance.attach('picture', '/some/dir/test')
        await instance.attach('picture', '/some/dir/test2')
      } catch (err) {
        expect(err).toEqual(
          new StorageError(testStorage, 'storage remove error')
        )
      }

      TestPreprocessor.process.mockImplementationOnce(() => {
        throw new Error('preprocessor error')
      })

      try {
        await instance.attach('picture', '/some/dir/test')
      } catch (err) {
        expect(err).toEqual(
          new PreprocessorError(TestPreprocessor, 'preprocessor error')
        )
      }
    })

    it('should detach files if called with null', async () => {
      expect.assertions(2)
      instance.picture = {
        original: '/stored/some/dir/test',
        small: '/stored/some/dir/test_small'
      }

      try {
        await instance.attach('picture', null)
        expect(instance.picture).toEqual(null)

        expect(testStorage.remove).toHaveBeenCalledTimes(2)
      } catch (err) {
        throw err
      }
    })
  })

  describe('detach', () => {
    let instance

    beforeEach(() => {
      instance = new TestModel(testInstanceProps)
      TestPreprocessor.process.mockClear()
      testStorage.write.mockClear()
      testStorage.remove.mockClear()
    })

    it('should detach & remove stored files for attribute with styles', async () => {
      expect.assertions(2)
      instance.picture = {
        original: '/stored/test',
        small: '/stored/test_small'
      }

      try {
        await instance.detach('picture')
        expect(instance.picture).toEqual(null)
        expect(testStorage.remove).toHaveBeenCalledTimes(2)
      } catch (err) {
        throw err
      }
    })

    it('should detach & remove stored file for scalar attribute', async () => {
      expect.assertions(2)
      instance.scalar = '/stored/test'

      try {
        await instance.detach('scalar')
        expect(instance.scalar).toEqual(null)
        expect(testStorage.remove).toHaveBeenCalledTimes(1)
      } catch (err) {
        throw err
      }
    })
  })

  describe('handleAfterDelete', () => {
    const i = new AttachmentsPlugin(
      TestProvider,
      defaultOptions
    )

    it('should throw if instance hasn\'t been passed', async () => {
      expect.assertions(1)

      try {
        await i.handleAfterDelete()
      } catch (err) {
        expect(err)
        .toEqual(
          new Error(
            PROVIDER_DIDNT_BIND_INSTANCE(
              TestProvider,
              'afterDelete'
            )
          )
        )
      }
    })

    it('shoud pass stored file attribute and instance to' +
      'storage.remove()', async () => {
      expect.assertions(5)
      testStorage.remove.mockClear()

      const instance = {
        id: 1,
        name: 'Test User',
        crop: 100,
        picture: {
          small: '/some/dir/tmp/test_pic_small',
          original: '/some/dir/tmp/test_pic_original'
        },
        bg: {
          original: '/some/dir/tmp/test_bg_original'
        },
        scalar: '/some/dir/tmp/test_scalar'
      }

      try {
        await i.handleAfterDelete(instance)

        expect(testStorage.remove)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_pic_small',
            'picture',
            instance
          )
        expect(testStorage.remove)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_pic_original',
            'picture',
            instance
          )

        expect(testStorage.remove)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_bg_original',
            'bg',
            instance
          )

        expect(testStorage.remove)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_scalar',
            'scalar',
            instance
          )

        expect(testStorage.remove)
          .toHaveBeenCalledTimes(4)
      } catch (err) {
        throw err
      }
    })
  })
})
