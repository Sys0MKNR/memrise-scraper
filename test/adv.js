const { exec } = require('../src')

const conf = require('../conf.json');

(async () => {
  const opts = {
    creds: conf.creds,
    courses: [
      '80119',
      'https://app.memrise.com/course/2021170/japanese-2/',
      {
        levels: '1-4',
        id: '2022732'
      },
      {
        url: 'https://app.memrise.com/course/2141906/korean-1/',
        levels: [1]
      },
      {
        url: 'https://app.memrise.com/course/2022732/japanese-1/'
      }
    ]

  }

  await exec(opts)
})()
