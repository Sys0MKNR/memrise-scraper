const path = require('path')
const util = require('util')

const fs = require('fs-extra')
const cheerio = require('cheerio')
const rangeParser = require('parse-numeric-range')
const axios = require('axios')
const rateLimit = require('axios-rate-limit')

const log = require('loglevel')

const utils = require('./utils')
const Transliterator = require('./transliterator')

axios.defaults.withCredentials = true

class Course {
  constructor (course) {
    const {
      id,
      url,
      levels
    } = course
    this.id = id
    this.url = url
    this.levels = levels
    this.allLevels = !levels
  }
}

class Level {
  constructor (course, index) {
    this.course = course
    this.index = index
    this.paddedIndex = this.index.toString().padStart(3, '0')
    this.lang = course.lang
    this.id = null
    this.name = null
  }
}

class MemriseScraper {
  constructor (options = {}) {
    const {
      creds,
      courses,
      logLevel,
      root
    } = options

    this.auth = {
      creds
    }

    this.unParsedCourses = courses
    this.courses = null
    this.basePath = root || path.join(__dirname, '../data')
    this.browser = null
    this.pages = []

    this.baseURL = 'https://app.memrise.com'
    this.courseBaseUrl = `${this.baseURL}/course/`
    this.loginUrl = `${this.baseURL}/signin`
    this.apiUrl = `${this.baseURL}/v1.17`
    this.authUrl = `${this.apiUrl}/auth/access_token/`

    this.transliterator = new Transliterator()
    this.ax = rateLimit(
      axios.create({
        withCredentials: true
      }),
      {
        maxRequests: 2,
        perMilliseconds: 1000,
        maxRPS: 2
      }
    )

    this.logLevel = logLevel || 'info'
    log.setLevel(this.logLevel)
    // log.setLevel('debug')
  }

  getLevelUrl (level) {
    return `${this.apiUrl}/learning_sessions/preview/?course_id=${level.course.id}&level_index=${level.index}`
  }

  async login () {
    log.info('[login]')
    let res = await this.ax.get(this.loginUrl)
    const id = res.data.match(/(?<=OAUTH_CLIENT_ID":"\s*).*?(?=\s*",")/gs)

    this.auth.loginObj = {
      username: this.auth.creds.username,
      password: this.auth.creds.pw,
      grant_type: 'password',
      client_id: id[0]
    }

    res = await this.ax.post(
      this.authUrl,
      this.auth.loginObj)

    if (res.status === 200) {
      this.auth.token = res.data.access_token.access_token
      this.auth.config = {
        headers: { Authorization: `Bearer ${this.auth.token}` }
      }
      log.info('[login] OK')
    } else {
      log.info(`[login] ERR ${res.status}`)
      throw new Error('login err')
    }
  }

  prepareCourses (unParsedCourses) {
    const courses = []

    for (const c of unParsedCourses) {
      const course = new Course(c)

      if (!utils.isObject(c)) {
        if (isNaN(c)) {
          course.url = c
        } else {
          course.id = c
        }
      } else {
        if (!course.url && !course.id) {
          throw new Error('no course url or id')
        }
      }

      if (!course.id) {
        course.id = course.url.split('/')[4]
      }

      course.id = course.id.toString()

      if (!course.url) {
        course.url = this.courseBaseUrl + course.id
      }

      courses.push(course)
    }

    return courses
  }

  async run () {
    try {
      log.info('[start]')
      await fs.ensureDir(this.basePath)

      await this.transliterator.init()

      this.courses = this.prepareCourses(this.unParsedCourses)

      await this.login()

      for (const course of this.courses) {
        try {
          await this.prepareLevels(course)
          await this.scrapCourse(course)
        } catch (error) {
          log.warn(`[ERR] course ${course.id} failed`)
          log.debug(error)
        }
      }

      log.info('[finished]')
    } catch (error) {
      log.info('[ERR]')
      log.debug(error)
    }
  }

  async prepareLevels (course) {
    log.info('[course] prepare')
    const res = await this.ax
      .get(course.url, this.auth.config)

    const $ = cheerio.load(res.data)

    let elem = $('.course-breadcrumb')

    course.lang = elem.children().last().text().trim()

    elem = $('.level.clearfix')

    const maxLevels = elem.length
    // log.info('max levels = ' + maxLevels)
    let levels = []

    if (Array.isArray(course.levels)) {
      levels = [...new Set(course.levels.filter(l => !isNaN(l) && l > 0 && l <= maxLevels))]
    } else {
      if (course.allLevels) {
        levels = Array.from({ length: maxLevels }, (_, i) => i + 1)
      } else {
        levels = [...new Set(rangeParser(course.levels).filter(l => l > 0 && l <= maxLevels))]
      }
    }

    course.levels = levels.map(l => new Level(course, l))

    log.debug(course)
  }

  async scrapCourse (course) {
    log.info(`[course]: id=${course.id}`)
    for (const level of course.levels) {
      try {
        await this.scrapLevel(level)
      } catch (error) {
        log.error(`SCRAP_LEVEL ERR: [index=${level.index}]`)
        log.debug(error)
      }
    }
  }

  async scrapLevel (level) {
    log.info(`[level ${level.index}] start`)

    const res = await this.ax
      .get(this.getLevelUrl(level),
        {
          validateStatus: status => true,
          ...this.auth.config
        })

    level.status = res.status

    log.info(`[level ${level.index}] status: ${level.status}`)

    if (level.status === 200) {
      log.info(`[level ${level.index}] OK`)

      const data = res.data

      await this.parseLevel(level, data)

      const outDirPath = path.join(this.basePath, level.course.id)
      const outPath = path.join(outDirPath, `${level.lang}-${level.course.id}-${level.paddedIndex}.json`)
      await fs.ensureDir(outDirPath)

      log.info(`[level ${level.index}] write to ${outPath}`)
      await fs.writeFile(outPath, JSON.stringify(this.levelToSimpleObj(level), null, 3))
    } else if (level.status === 400) {
      log.error(`[level ${level.index}] ERROR: probably not a standard level`)
    } else if (level.status === 404) {
      log.error(`[level ${level.index}] ERROR: level not found`)
    } else {
      log.error(`[level ${level.index}] ERROR: ${level.status} `)
    }
  }

  levelToSimpleObj (level) {
    const {
      course,
      id,
      index,
      lang,
      name,
      words
    } = level

    return {
      course_id: course.id,
      course_url: course.url,
      id,
      index,
      lang,
      name,
      words
    }
  }

  async parseLevel (level, data) {
    level.id = data.course.level_id.toString()
    level.name = data.course.level_name
    level.words = []

    for (const w of data.learnables) {
      const info = w.screens['1']

      const word = {
        item: this.parseItem(info.item),
        definition: this.parseItem(info.definition),
        info: this.parseInfo(info),
        difficulty: w.difficulty
      }

      word.audio = info.audio ? info.audio.value : []

      word.transliteration = await this.transliterator.transliterate(word.item.value, level.course.lang)

      level.words.push(word)
    }
  }

  parseItem (item) {
    const {
      label,
      kind,
      value
    } = item

    return {
      label,
      kind,
      value
    }
  }

  parseInfo (info) {
    return [...info.visible_info, ...info.hidden_info].map(x => this.parseItem(x))
  }

  wrapUp () {

  }
}

async function exec (opts) {
  const m = new MemriseScraper(opts)
  return m.run()
}

module.exports = { exec, MemriseScraper }
