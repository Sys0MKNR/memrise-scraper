const hangulRomanization = require('hangul-romanization')
const cyrillicToTranslit = require('cyrillic-to-translit-js')
const Kuroshiro = require('kuroshiro')
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji')

class Transliterator {
  constructor () {
    this.kuroshiro = new Kuroshiro()
    this.hangulRomanization = hangulRomanization
    this.cyrillicToTranslit = cyrillicToTranslit
  }

  async init () {
    await this.kuroshiro.init(new KuromojiAnalyzer())
  }

  async transliterate (s, lang) {
    const obj = {}

    switch (lang) {
      case 'Korean':
        obj.romanization = this.hangulRomanization.convert(s)
        break
      case 'Russian':
        obj.romanization = this.cyrillicToTranslit().transform(s)
        break
      case 'Japanese':
        obj.all = await this.handleJapanese(s)
        obj.romanization = obj.all['romaji-spaced-hepburn']
        break
      case 'zh':
        break
      default:
        break
    }

    return obj
  }

  async handleJapanese (s) {
    const modes = [
      'normal',
      'spaced',
      'okurigana',
      'furigana'
    ]

    const target1 = [
      'hiragana',
      'katakana'
    ]

    const target2 = [
      'romaji'
    ]

    const romanizationSystem = [
      'nippon',
      'passport',
      'hepburn'
    ]

    const a = cartesian(target1, modes)
    const b = cartesian(target2, modes, romanizationSystem)
    const c = [...a, ...b]

    const y = {}

    for (const x of c) {
      const [to, mode, romajiSystem] = x

      const result = await this.kuroshiro.convert(s, { to, mode, romajiSystem })
      y[x.join('-')] = result
    }

    return y
  }
}

const cartesian = (...a) => a.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())))

module.exports = Transliterator
