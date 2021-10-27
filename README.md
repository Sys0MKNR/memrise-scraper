# scrap vocab from memrise courses

# install

```
npm install Sys0MKNR/memrise-scraper
```

# usage



```js
const { exec } = require('memrise-scraper')

 const opts = {
    creds: conf.creds,
    courses: [
      '80119'    
    ]

  }

  await exec(opts)

```


# options


## creds [Object]

* pw 
* user



## courses [Array]

Can either be a String of the course id or url or an Object with url and level parameter.

Level is an Array or range string wich can be used to define what exact levels should be scraped. 

parse-numeric-range is used for range parsing.


```js
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
```


## loglevel [String]


## root [String]

Filepath for the ouput files. 


