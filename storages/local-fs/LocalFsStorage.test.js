/* eslint-env jest */

const LocalFsStorage = require('./LocalFsStorage')

const {
  NO_PUBLIC_BASEPATH_ERROR,
  NO_PATH_TO_PUBLIC_ERROR
} = LocalFsStorage

jest.mock('fs-extra')

const { __setMockFiles, __getMockFiles } = require('fs-extra')

describe('LocalFsStorage', () => {
  describe('constructor', () => {
    it('should validate options', () => {
      expect(() => {
        new LocalFsStorage() //eslint-disable-line
      }).toThrow(NO_PUBLIC_BASEPATH_ERROR)
      expect(() => {
        new LocalFsStorage({ //eslint-disable-line
          publicBasepath: '/images'
        })
      }).toThrow(NO_PATH_TO_PUBLIC_ERROR)
    })
  })

  const storage = new LocalFsStorage({
    publicBasepath: '/images',
    pathToPublic: '/some/dir/public'
  })

  describe('write', () => {
    it('should resolve and write when file is string', async () => {
      __setMockFiles(['/some/tmp/test.jpg'])

      expect.assertions(3)
      try {
        const stored = await storage.write('/some/tmp/test.jpg')
        expect(stored).toBe('/images/test.jpg')
      } catch (err) {
        throw err
      }

      const mockFiles = __getMockFiles()

      expect(mockFiles['/some/dir/public/images'])
        .toEqual(['test.jpg'])
      expect(mockFiles['/some/tmp'].indexOf('test.jpg'))
        .toBe(-1)
    })

    it('should reject when file doesn\'t exist', async () => {
      __setMockFiles([])

      expect.assertions(1)
      try {
        await storage.write('/some/tmp/test.jpg')
      } catch (err) {
        expect(err).toEqual(new Error('ENOENT'))
      }
    })

    it('should write with dynamic publicBasepath', async () => {
      const storage = new LocalFsStorage({
        publicBasepath: (attribute, instance) =>
          `/users/${instance.id}/${attribute}s`,
        pathToPublic: '/some/dir/public'
      })

      __setMockFiles(['/some/tmp/test.jpg'])

      expect.assertions(3)
      try {
        const stored = await storage.write(
          '/some/tmp/test.jpg',
          'picture',
          { id: 1 }
        )
        expect(stored).toBe('/users/1/pictures/test.jpg')
      } catch (err) {
        throw err
      }

      const mockFiles = __getMockFiles()
      expect(mockFiles['/some/dir/public/users/1/pictures'])
        .toEqual(['test.jpg'])
      expect(mockFiles['/some/tmp'].indexOf('test.jpg'))
        .toBe(-1)
    })
  })

  describe('remove', () => {
    it('should resolve and remove', async () => {
      __setMockFiles(['/some/dir/public/images/test.jpg'])
      expect.assertions(2)
      try {
        await storage.remove('/images/test.jpg')
        const mockFiles = __getMockFiles()
        expect(mockFiles['/some/dir/public/images'])
          .toBeUndefined()
        expect(mockFiles['/some/dir/public'])
          .toEqual([])
      } catch (err) {
        throw err
      }
    })

    it('should remove all empty folders', async () => {
      const storage = new LocalFsStorage({
        publicBasepath: '/users/pictures',
        pathToPublic: '/some/dir/public'
      })
      __setMockFiles(['/some/dir/public/users/pictures/test.jpg'])
      expect.assertions(1)
      try {
        await storage.remove('/users/pictures/test.jpg')
        const mockFiles = __getMockFiles()
        expect(mockFiles['/some/dir/public/users'])
          .toBeUndefined()
      } catch (err) {
        throw err
      }
    })

    it('should remove all empty folders for dynamic publicBasepath', async () => {
      const storage = new LocalFsStorage({
        publicBasepath: (attribute, instance) =>
          `/users/${instance.id}/${attribute}s`,
        pathToPublic: '/some/dir/public'
      })

      __setMockFiles(['/some/dir/public/users/1/pictures/test.jpg'])

      expect.assertions(1)
      try {
        await storage.remove(
          '/users/1/pictures/test.jpg',
          'picture',
          { id: 1 }
        )
        const mockFiles = __getMockFiles()
        expect(mockFiles['/some/dir/public/users'])
          .toBeUndefined()
      } catch (err) {
        throw err
      }
    })
  })
})
