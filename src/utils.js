const util = require('util')
const stream = require('stream')

const pipeline = util.promisify(stream.pipeline)

const fs = require('fs-extra')
const axios = require('axios')

module.exports = {
  isObject (val) {
    return val != null && typeof val === 'object' && Array.isArray(val) === false
  },
  async downloadFile (url, filePath) {
    const res = await axios({
      method: 'get',
      url,
      responseType: 'stream'
    })

    return pipeline(res.data, fs.createWriteStream(filePath))
  }
}
