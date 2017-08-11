/* eslint-env jest */

const IMPreprocessor = require('./IMPreprocessor')
const {
  getArgsFromProps,
  getFilenameForStyle,
  convert,
  NO_STYLES_ERROR,
  NO_PROPERTIES_ERROR
} = IMPreprocessor

jest.mock('imagemagick', () => ({
  convert: jest.fn((args = [], cb) => {
    return cb(null, true)
  })
  .mockImplementationOnce((args = [], cb) => {
    return cb(null, true)
  })
  .mockImplementationOnce((args = [], cb) => {
    return cb(new Error('convert error'))
  })
}))

describe('IMPreprocessor', () => {
  describe('getArgsFromProps', () => {
    it('should create array of arguments from properties obect', () => {
      expect(getArgsFromProps({
        blur: 5,
        resize: '25x120',
        $format: 'png',
        '+sigmoidal-contrast': 3
      })).toEqual([
        '-blur', '5',
        '-resize', '25x120',
        '+sigmoidal-contrast', '3'
      ])
    })

    it('should throw if properties object is invalid', () => {
      expect(() => { getArgsFromProps() }).toThrow()
      expect(() => { getArgsFromProps(2) }).toThrow()
      expect(() => { getArgsFromProps('') }).toThrow()
      expect(() => { getArgsFromProps({}) }).toThrow()
    })
  })

  describe('getFilenameForStyle', () => {
    it('should return filename with style appended', () => {
      expect(getFilenameForStyle('/some/dir/test.jpg', 'small'))
        .toBe('/some/dir/test_small.jpg')

      expect(getFilenameForStyle('/some/dir/test', 'small'))
        .toBe('/some/dir/test_small')
    })
  })

  describe('convert', async () => {
    it('resolves', () => {
      const resolved = convert(
        'test.jpg',
        'test_small.jpg',
        ['-resize', '25x120']
      )

      expect.assertions(1)
      return expect(resolved).resolves.toBe('test_small.jpg')
    })

    it('rejects', () => {
      const resolved = convert(
        'test.jpg',
        'test_small.jpg',
        ['-resize', '25x120']
      )
      expect.assertions(1)
      return expect(resolved).rejects.toEqual(
        new Error('convert error')
      )
    })
  })

  describe('process', async () => {
    const staticStyles = {
      thumb: {
        resize: '16x16'
      },
      blurred: {
        resize: '48x48',
        blur: 5
      }
    }

    const dynamicStyles = {
      thumb: {
        resize: '16x16'
      },
      blurred: (data) => ({
        resize: '48x48',
        blur: data.blur
      })
    }

    it('resolves', async () => {
      expect.assertions(4)

      try {
        expect(
          await IMPreprocessor.process(
            '/some/dir/test.jpg',
            staticStyles
          )
        ).toEqual({
          thumb: '/some/dir/test_thumb.jpg',
          blurred: '/some/dir/test_blurred.jpg'
        })

        expect(
          await IMPreprocessor.process(
            '/some/dir/test.jpg',
            dynamicStyles,
            { blur: 5 }
          )
        ).toEqual({
          thumb: '/some/dir/test_thumb.jpg',
          blurred: '/some/dir/test_blurred.jpg'
        })

        expect(
          await IMPreprocessor.process('/some/dir/test.jpg',
          Object.assign(staticStyles, { original: true }))
        ).toEqual({
          original: '/some/dir/test.jpg',
          thumb: '/some/dir/test_thumb.jpg',
          blurred: '/some/dir/test_blurred.jpg'
        })

        expect(await IMPreprocessor.process('/some/dir/test.jpg', {
          thumb: {
            $format: 'gif'
          }
        })).toEqual({
          thumb: '/some/dir/test_thumb.gif'
        })
      } catch (err) {
        throw err
      }
    })

    it('rejects', () => {
      expect.assertions(3)

      return Promise.all([
        expect(
          IMPreprocessor.process('/some/dir/test.jpg')
        ).rejects.toEqual(new Error(NO_STYLES_ERROR)),
        expect(
          IMPreprocessor.process('/some/dir/test.jpg', {
            original: true
          })
        ).rejects.toEqual(new Error(NO_STYLES_ERROR)),
        expect(
          IMPreprocessor.process('/some/dir/test.jpg', {
            some: {}
          })
        ).rejects.toEqual(new Error(NO_PROPERTIES_ERROR))
      ])
    })
  })
})
