const { exec } = require('../src')

const conf = require('../conf.json');

(async () => {
  const opts = {
    creds: conf.creds,
    courses: [
      {
        levels: '1-3',
        id: '2022732'
      }
    ]
  }

  await exec(opts)
})()
