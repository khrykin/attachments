/* eslint-env jest */

const createPlugin = require('./')

const {
  AttachmentsPlugin,
  PROVIDER_NOT_SET,
  STORAGE_NOT_SET_ERROR,
  ATTRIBUTES_NOT_SET_ERROR,
  PREPROCESSOR_NOT_SET_ERROR,
  PROVIDER_DIDNT_PASS_INSTANCE,
  PROVIDER_DIDNT_PASS_IS_MODIFIED// ,
  // PROVIDER_ADD_ATTRIBUTE_NOT_SET,
  // PROVIDER_BEFORE_SAVE_NOT_SET,
  // PROVIDER_AFTER_DELETE_NOT_SET
} = createPlugin

const TestModel = {
  id: Number,
  name: String
}

const testInstance = {
  id: 1,
  name: 'Test User',
  crop: 100,
  picture: '/some/dir/tmp/test_pic',
  bg: '/some/dir/tmp/test_bg',
  scalar: '/some/dir/tmp/test_scalar'
}

const testStorage = {
  write: jest.fn(),
  remove: jest.fn()
}

const TestProvider = {
  name: 'test',
  addAttribute: jest.fn(),
  beforeSave: jest.fn(),
  afterDelete: jest.fn()
}

const TestPreprocessor = {
  process: jest.fn((file, styles) => {
    let processed = {}
    for (let style in styles) {
      // console.log('file in preprocessor', file)
      processed[style] = `${file}_${style}`
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
      }).toThrow(PROVIDER_NOT_SET)

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
    it('should pass model and style names to provider\'s ' +
        'addAttribute as arguments', () => {
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

  describe('handleBeforeSave', () => {
    const i = new AttachmentsPlugin(
      TestProvider,
      defaultOptions
    )

    it('should throw if instance or isModified' +
    ' haven\'t been passed', async () => {
      expect.assertions(2)

      try {
        await i.handleBeforeSave()
      } catch (err) {
        expect(err)
        .toEqual(new Error(
          PROVIDER_DIDNT_PASS_INSTANCE(
            TestProvider,
            'beforeSave'
          )
        ))
      }

      try {
        await i.handleBeforeSave(testInstance)
      } catch (err) {
        expect(err)
        .toEqual(new Error(
          PROVIDER_DIDNT_PASS_IS_MODIFIED(TestProvider)
        ))
      }
    })

    it('should call preprocessor.process() with file' +
    ' and evaluated styles', async () => {
      expect.assertions(3)
      TestPreprocessor.process.mockClear()

      try {
        const instance = Object.assign({}, testInstance)
        await i.handleBeforeSave(instance, () => true)

        expect(TestPreprocessor.process)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_pic', {
              original: true,
              small: {
                resize: '16x16',
                crop: 100
              }
            },
            instance
          )

        expect(TestPreprocessor.process)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_bg', {
              original: true
            },
            instance
          )

        expect(TestPreprocessor.process)
          .toHaveBeenCalledTimes(2)
      } catch (err) {
        throw err
      }
    })

    it('should call styles.validate() with file' +
    ' and instance and callback', async () => {
      expect.assertions(1)
      const { validate } = defaultOptions.attributes.picture
      validate.mockClear()

      try {
        const instance = Object.assign({}, testInstance)
        await i.handleBeforeSave(instance, () => true)
        expect(validate).toHaveBeenCalledTimes(1)
      } catch (err) {
        throw err
      }
    })

    it('should call storage.write() with processed files' +
       ', attribute name and instance', async () => {
      expect.assertions(5)
      testStorage.write.mockClear()

      try {
        const instance = Object.assign({}, testInstance)
        await i.handleBeforeSave(instance, () => true)

        expect(testStorage.write)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_pic_small',
            'picture',
            instance
          )

        expect(testStorage.write)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_pic_original',
            'picture',
            instance
          )

        expect(testStorage.write)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_bg_original',
            'bg',
            instance
          )

        expect(testStorage.write)
          .toHaveBeenCalledWith(
            '/some/dir/tmp/test_scalar',
            'scalar',
            instance
          )

        expect(testStorage.write)
          .toHaveBeenCalledTimes(4)
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
            PROVIDER_DIDNT_PASS_INSTANCE(
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
