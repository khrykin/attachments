/* eslint-env jest */
const path = require('path')
const fs = jest.genMockFromModule('fs-extra')

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let mockFiles = Object.create(null)
function __setMockFiles (newMockFiles) {
  mockFiles = Object.create(null)
  for (const file of newMockFiles) {
    const dir = path.dirname(file)

    if (!mockFiles[dir]) {
      mockFiles[dir] = []
    }

    mockFiles[dir].push(path.basename(file))
  }
}

function __getMockFiles () {
  return mockFiles
}

function __exists (file) {
  if (mockFiles[file]) return true

  const dirname = path.dirname(file)
  const basename = path.basename(file)

  if (!mockFiles[dirname]) return false

  return !!(mockFiles[dirname].indexOf(basename) > -1)
}

function __write (file) {
  const dir = path.dirname(file)

  if (!mockFiles[dir]) {
    throw new Error('ENOENT')
  }

  mockFiles[dir].push(path.basename(file))
}

async function ensureDir (dir) {
  if (!mockFiles[dir]) {
    mockFiles[dir] = []
  }
}

async function copy (from, to) {
  if (!__exists(from)) {
    throw new Error('ENOENT')
  }
  __write(to)
}

async function remove (file) {
  if (mockFiles[file]) { // remove directory
    const parentDir = path.dirname(file)
    delete mockFiles[file]

    if (!mockFiles[parentDir]) {
      mockFiles[parentDir] = []
    }
    return
  }

  const dir = path.dirname(file)
  const basename = path.basename(file)

  if (
    !mockFiles[dir] ||
    mockFiles[dir].indexOf(basename) < 0
  ) {
    throw new Error('ENOENT')
  }

  mockFiles[dir].splice(mockFiles[dir].indexOf(basename), 1)
}

async function readdir (dir) {
  return mockFiles[dir] || []
}

Object.assign(fs, {
  __setMockFiles,
  __getMockFiles,
  copy,
  ensureDir,
  remove,
  readdir
})

module.exports = fs
