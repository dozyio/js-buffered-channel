/** @type {import('aegir').PartialOptions} */
export default {
  build: {
    config: {
      entryPoints: ['src/index.ts'],
      bundle: true,
    }
  },
  test: {
    files: [
      'test/**/buffered-channel.spec.ts'
    ],
    target: ['node']
  }
}

